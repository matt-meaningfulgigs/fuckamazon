import { chromium } from "playwright-extra";
import * as fs from "fs";
import * as dotenv from "dotenv";
import { createInterface } from "readline";
import * as path from "path";
dotenv.config();

// Apply the stealth plugin to bypass bot detection
const stealth = require("puppeteer-extra-plugin-stealth")();
chromium.use(stealth);

// Helper function to prompt user input via the command line
function askQuestion(query: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Interface for storing scraped wishlist item data
interface WishlistItem {
  itemName: string;
  manufacturer: string;
  options: string[];
  productLink: string;    // Amazon URL built from the wishlist
  nonAmazonLink: string;  // "Real" product URL from DuckDuckGo search
}

// Helper function to escape CSV fields if needed
function escapeCSV(field: string): string {
  if (field.includes('"') || field.includes(",") || field.includes("\n")) {
    field = field.replace(/"/g, '""');
    return `"${field}"`;
  }
  return field;
}

async function main() {
  // Determine which Chrome executable to use
  const isMac = process.platform === "darwin";
  const defaultChromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  let executablePath = chromium.executablePath();
  if (isMac && fs.existsSync(defaultChromePath)) {
    console.log("Using system Chrome on macOS");
    executablePath = defaultChromePath;
  } else {
    console.log("Using Playwright Chromium...");
  }

  // Run headless if on CI or explicitly set via env variable
  const isCI = process.env.CI === "true";
  const HEADLESS = process.env.HEADLESS === "true" || isCI;

  // Launch the browser with anti-bot settings
  const browser = await chromium.launch({
    headless: HEADLESS,
    executablePath,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });

  // Create a browser context with a custom user agent to help hide automation
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  // Set the default wishlist URL and prompt user if desired
  const defaultWishlistUrl = "https://www.amazon.com/hz/wishlist/ls/QF7GGWSPEL1A";
  const inputUrl = await askQuestion(
    `Enter your wishlist URL(s) (comma separated, public wishlists only) (default: ${defaultWishlistUrl}): `
  );
  // Allow multiple URLs separated by a comma; if none provided, use the default
  const wishlistUrls = inputUrl.trim()
    ? inputUrl.split(",").map(url => url.trim())
    : [defaultWishlistUrl];

  // Loop over each provided wishlist URL
  for (const wishlistUrl of wishlistUrls) {
    console.log(`Navigating to Amazon wishlist: ${wishlistUrl}`);
    await page.goto(wishlistUrl, { waitUntil: "domcontentloaded" });

    // Allow initial content and lazy-loaded items to load
    await page.waitForTimeout(20000);

    // Get the wishlist name from the element with id "profile-list-name"
    // (this will be used to name the CSV file)
    let wishlistName = "wishlist";
    try {
      // Using XPath to locate the wishlist name element
      const wishlistNameElem = await page.$('//span[@id="profile-list-name"]');
      if (wishlistNameElem) {
        wishlistName = (await wishlistNameElem.innerText()).trim();
        // Sanitize wishlistName for file name (replace non-alphanumeric with underscores)
        wishlistName = wishlistName.replace(/[^a-zA-Z0-9]/g, "_");
      }
    } catch (e) {
      console.error("Could not determine wishlist name, using default name.");
    }

    // Scroll until the "End of list" element is visible or until a maximum number of scrolls is reached
    const endOfListSelector = 'h1:has-text("End of list")';
    const maxScrolls = 30;
    let scrollCount = 0;
    let endOfListVisible = false;
    while (!endOfListVisible && scrollCount < maxScrolls) {
      try {
        const endOfList = await page.$(endOfListSelector);
        if (endOfList && (await endOfList.isVisible())) {
          endOfListVisible = true;
          break;
        }
      } catch (e) {
        // Ignore errors if the element isn't found yet.
      }
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(1000); // Allow lazy-loaded items to render
      scrollCount++;
    }
    if (endOfListVisible) {
      console.log("Reached the end of the list.");
    } else {
      console.log("End of list not detected after maximum scrolls; proceeding.");
    }

    // Array to store scraped wishlist items
    const items: WishlistItem[] = [];

    // Get all wishlist item containers (divs with an id containing "itemInfo_")
    const itemElements = await page.$$('div[id*="itemInfo_"]');
    console.log(`Found ${itemElements.length} item elements.`);

    // Loop through each wishlist item to extract data
    for (const itemElement of itemElements) {
      let itemName = "";
      let manufacturer = "";
      const options: string[] = [];
      let productLink = "";
      let nonAmazonLink = "";

      // Check if the element has a NON_ASIN marker (indicating a different structure)
      const nonAsinElement = await itemElement.$('div[data-csa-c-item-id*="NON_ASIN"]');
      if (nonAsinElement) {
        // For NON_ASIN items, get the text from the anchor and check if it appears to be a URL.
        const itemNameElem = await itemElement.$('span[id*="itemName_"]');
        if (itemNameElem) {
          const text = (await itemNameElem.innerText()).trim();
          const urlRegex = /^https?:\/\/[^\s]+$/i;
          if (urlRegex.test(text)) {
            nonAmazonLink = text;
          } else {
            itemName = text;
          }
        }
      } else {
        // For standard items, extract item name and product link from the anchor.
        const itemNameElem = await itemElement.$('a[id*="itemName_"]');
        if (itemNameElem) {
          itemName = (await itemNameElem.innerText()).trim();
          const href = await itemNameElem.getAttribute("href");
          if (href) {
            try {
              const fullUrl = new URL(href, "https://www.amazon.com");
              fullUrl.searchParams.delete("psc");
              fullUrl.searchParams.delete("ref_");
              fullUrl.searchParams.set("th", "1");
              productLink = fullUrl.toString();
            } catch (err) {
              console.error("Error parsing href:", href, err);
            }
          }
        }
        // Get manufacturer from the byline, if available.
        const bylineElem = await itemElement.$('span[id*="item-byline-"]');
        if (bylineElem) {
          manufacturer = (await bylineElem.innerText()).trim();
        }
        // Get all options from multiple "twisterText" spans.
        const twisterElems = await itemElement.$$('span#twisterText');
        for (const twisterElem of twisterElems) {
          const option = (await twisterElem.innerText()).trim();
          if (option) {
            options.push(option);
          }
        }
      }

      if (itemName || productLink || nonAmazonLink) {
        console.log("Scraped item:", { itemName, manufacturer, options, productLink, nonAmazonLink });
        items.push({ itemName, manufacturer, options, productLink, nonAmazonLink });
      }
    }

    // For each scraped item, attempt to get a "real" product URL from DuckDuckGo
    // (unless a non-Amazon link was already provided from the NON_ASIN branch)
    for (const item of items) {
      if (item.nonAmazonLink) continue;
      const query = encodeURIComponent(item.itemName);
      const duckUrl = `https://duckduckgo.com/?t=h_&q=official+site+${query}++-site%3Aamazon.*&t=h_&ia=web`;
      console.log("Navigating to DuckDuckGo search:", duckUrl);
      await page.goto(duckUrl, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);
      try {
        const nonAmazonAnchor = await page.waitForSelector('li[data-layout="organic"] h2 a', { timeout: 10000 });
        if (nonAmazonAnchor) {
          let href = await nonAmazonAnchor.getAttribute("href");
          if (href) {
            const match = href.match(/uddg=([^&]+)/);
            if (match && match[1]) {
              const decodedUrl = decodeURIComponent(match[1]);
              item.nonAmazonLink = decodedUrl;
            } else {
              item.nonAmazonLink = href;
            }
          }
        }
      } catch (e) {
        console.log("DuckDuckGo organic result not found for:", item.itemName);
      }
    }

    // Determine the maximum number of options across all items.
    const maxOptions = items.reduce((max, item) => Math.max(max, item.options.length), 0);

    // Build CSV header (including columns for Amazon and non-Amazon links)
    const headerColumns = ["Item Name", "Manufacturer", "Product Link", "Non-Amazon Link"];
    for (let i = 1; i <= maxOptions; i++) {
      headerColumns.push(`Option ${i}`);
    }
    const csvRows = [headerColumns.map(escapeCSV).join(",")];

    // Build CSV rows for each item.
    for (const item of items) {
      const row = [
        escapeCSV(item.itemName),
        escapeCSV(item.manufacturer),
        escapeCSV(item.productLink),
        escapeCSV(item.nonAmazonLink),
        ...Array.from({ length: maxOptions }, (_, i) =>
          escapeCSV(item.options[i] || "")
        ),
      ];
      csvRows.push(row.join(","));
    }

    // Save CSV data to a file named after the wishlist
    const csvData = csvRows.join("\n");
    const outputFilePath = path.join(process.cwd(), `${wishlistName}.csv`);
    fs.writeFileSync(outputFilePath, csvData, "utf8");
    console.log(`Scraped data saved to CSV file: ${outputFilePath}`);
  }

  // Final wait then close the browser.
  await page.waitForTimeout(10000);
  await browser.close();
}

main().catch((err) => console.error("Unhandled error:", err));
