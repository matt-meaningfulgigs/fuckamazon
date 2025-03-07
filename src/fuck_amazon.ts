/**
 * @module FuckAmazon
 * @description Script to scrape Amazon wishlists and export data to CSV.
 * This tool extracts item names, manufacturers, options, and product links from public Amazon wishlists.
 * It also attempts to fetch non-Amazon product URLs via DuckDuckGo. Results are saved in a CSV file.
 */

import { chromium } from "playwright-extra";
import * as fs from "fs";
import { createInterface } from "readline";
import * as path from "path";
import imageToAscii from "image-to-ascii";

// Apply the stealth plugin to bypass bot detection.
/**
 * @description Load and apply stealth plugin to reduce bot detection.
 * @remarks This is required to prevent detection by Amazon's anti-bot mechanisms.
 */
const stealth = require("puppeteer-extra-plugin-stealth")();
chromium.use(stealth);

/**
 * @function askQuestion
 * @description Prompts the user for input via the command line.
 * @param {string} query - The question to display to the user.
 * @returns {Promise<string>} A promise that resolves with the user's input.
 */
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

/**
 * @function convertImageToAscii
 * @description Converts an image buffer to an ASCII art string using a temporary file.
 * @param {Buffer} buffer - The image buffer to convert (typically a CAPTCHA screenshot).
 * @returns {Promise<string>} A promise that resolves with the ASCII art representation.
 */
function convertImageToAscii(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    // Define temporary file path using current working directory.
    const tempFilePath = path.join(process.cwd(), "captcha_temp.png");

    // Write image buffer to temporary file.
    fs.writeFileSync(tempFilePath, buffer);

    // Convert the image file to ASCII art.
    imageToAscii(tempFilePath, { colored: false }, (err: any, converted: string) => {
      // Remove the temporary file once conversion is complete.
      fs.unlinkSync(tempFilePath);
      if (err) {
        reject(err);
      } else {
        resolve(converted);
      }
    });
  });
}

/**
 * @interface WishlistItem
 * @description Defines the structure for storing scraped wishlist item data.
 */
interface WishlistItem {
  /** Item name scraped from the wishlist. */
  itemName: string;
  /** Manufacturer name of the item. */
  manufacturer: string;
  /** Array of options (e.g., size, color) for the item. */
  options: string[];
  /** Cleaned Amazon product URL built from the wishlist data. */
  productLink: string;
  /** Alternative non-Amazon product URL fetched from DuckDuckGo. */
  nonAmazonLink: string;
}

/**
 * @function escapeCSV
 * @description Escapes a CSV field by wrapping it in quotes and doubling internal quotes if needed.
 * @param {string} field - The CSV field to escape.
 * @returns {string} The escaped CSV field.
 */
function escapeCSV(field: string): string {
  if (field.includes('"') || field.includes(",") || field.includes("\n")) {
    field = field.replace(/"/g, '""');
    return `"${field}"`;
  }
  return field;
}

/**
 * @function main
 * @description Main function that scrapes Amazon wishlists and exports the data to CSV files.
 * The process includes loading the wishlist page, handling CAPTCHA challenges, scrolling,
 * scraping item details, fetching alternative product links via DuckDuckGo, and saving the data.
 * @returns {Promise<void>} A promise that resolves when the scraping and export process is complete.
 */
async function main() {
  console.log("Starting the Amazon wishlist scraper...");

  // Determine the Chrome executable to use.
  const isMac = process.platform === "darwin";
  const defaultChromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  let executablePath = chromium.executablePath();
  if (isMac && fs.existsSync(defaultChromePath)) {
    console.log("Step 1: Using system Chrome on macOS.");
    executablePath = defaultChromePath;
  } else {
    console.log("Step 1: Using Playwright Chromium browser.");
  }
  
  // Launch the browser with anti-bot and no-sandbox arguments.
  console.log("Step 2: Launching headless browser...");
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });

  // Create a new browser context with a custom user agent to mimic genuine user activity.
  console.log("Step 3: Initializing browser context...");
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  // Prompt user to enter one or more Amazon wishlist URLs (public wishlists only).
  console.log("Step 4: Awaiting wishlist URL(s) from user input...");
  const inputUrl = await askQuestion(
    "Enter your wishlist URL(s) (comma separated, public wishlists only): "
  );
  // Split the input on commas, trim each URL, and filter for valid Amazon wishlist URLs.
  const wishlistUrls = inputUrl.trim()
    ? inputUrl.split(",").map(url => url.trim()).filter(url => url.startsWith("https://www.amazon.com/hz/wishlist/ls/"))
    : [];

  // Terminate execution if no valid URL is provided.
  if (wishlistUrls.length === 0) {
    console.error("Error: No valid Amazon wishlist URL provided. Please try again.");
    process.exit(1);
  }

  // Process each provided wishlist URL.
  for (const wishlistUrl of wishlistUrls) {
    console.log(`Step 5: Navigating to your Amazon wishlist: ${wishlistUrl}`);
    await page.goto(wishlistUrl, { waitUntil: "domcontentloaded" });

    // Check for a CAPTCHA challenge within the first 5 seconds.
    try {
      const captchaPrompt = await page.waitForSelector(
        'text=Enter the characters you see below',
        { timeout: 5000 }
      );
      if (captchaPrompt) {
        console.log("Alert: CAPTCHA challenge detected. Preparing to solve CAPTCHA...");
        // Locate the CAPTCHA container using an XPath selector.
        const captchaContainer = await page.$('//div[@class="a-row a-text-center"]');
        if (captchaContainer) {
          // Capture a screenshot of the CAPTCHA container.
          const captchaBuffer = await captchaContainer.screenshot();
          // Convert the CAPTCHA image to ASCII art.
          const asciiCaptcha = await convertImageToAscii(captchaBuffer);
          console.log("CAPTCHA image converted to ASCII art:\n", asciiCaptcha);
          // Prompt the user to manually enter the CAPTCHA text.
          const userCaptcha = await askQuestion("Please enter the CAPTCHA (letters will be converted to uppercase): ");
          // Find the CAPTCHA input field.
          const captchaInput = await page.$('input#captchacharacters');
          if (captchaInput) {
            // Fill in the CAPTCHA response in all caps and submit it.
            await captchaInput.fill(userCaptcha.toUpperCase());
            await captchaInput.press("Enter");
            console.log("Submitted CAPTCHA response. Waiting for verification...");
            // Allow time for the page to reload after CAPTCHA submission.
            await page.waitForTimeout(3000);
            // Check if CAPTCHA challenge is still present; if so, the CAPTCHA failed.
            const captchaStillPresent = await page.$('text=Enter the characters you see below');
            if (captchaStillPresent) {
              console.error("Error: CAPTCHA verification failed. Please check your input and try again.");
              process.exit(1);
            } else {
              console.log("CAPTCHA solved successfully.");
            }
          }
        }
      }
    } catch (e) {
      console.log("No CAPTCHA challenge detected. Continuing with wishlist scraping.");
    }

    // Extract the wishlist name for naming the CSV file.
    console.log("Step 6: Extracting the wishlist name for file output...");
    let wishlistName = "wishlist";
    try {
      const wishlistNameElem = await page.$('//span[@id="profile-list-name"]');
      if (wishlistNameElem) {
        wishlistName = (await wishlistNameElem.innerText()).trim();
        // Sanitize the wishlist name for safe file naming by replacing non-alphanumeric characters with underscores.
        wishlistName = wishlistName.replace(/[^a-zA-Z0-9]/g, "_");
      }
    } catch (e) {
      console.error("Warning: Could not determine the wishlist name. Default name will be used.");
    }
    // If the wishlist name is still the default, assume an error occurred.
    if (wishlistName === "wishlist") {
      console.error("Error: Unable to retrieve a valid wishlist name. The list may not be public or CAPTCHA verification may have failed. Exiting now.");
      process.exit(1);
    }
    console.log(`Success: Wishlist name determined as "${wishlistName}".`);

    // Scroll down until the "End of list" element is visible or until maximum scroll attempts are reached.
    console.log("Step 7: Scrolling to load all items in the wishlist. Please wait...");
    const endOfListSelector = 'h1:has-text("End of list")';
    const maxScrolls = 30;
    let scrollCount = 0;
    let endOfListVisible = false;
    while (scrollCount < maxScrolls) {
      // Manually scroll to the bottom to trigger lazy loading.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000); // Allow lazy-loaded items to render.
      try {
        const endOfList = await page.$(endOfListSelector);
        if (endOfList && (await endOfList.isVisible())) {
          endOfListVisible = true;
          break;
        }
      } catch (e) {
        // Ignore errors if the element is not yet available.
      }
      scrollCount++;
    }
    if (endOfListVisible) {
      console.log("Status: Reached the end of the wishlist.");
      // Keep scrolling to the "End of list" element until it remains continuously visible for 10 seconds.
      let continuousVisibleTime = 0;
      let lastCheck = Date.now();
      while (continuousVisibleTime < 10000) {
        const endOfList = await page.$(endOfListSelector);
        if (endOfList) {
          await endOfList.scrollIntoViewIfNeeded();
          const now = Date.now();
          if (await endOfList.isVisible()) {
            continuousVisibleTime += now - lastCheck;
          } else {
            continuousVisibleTime = 0;
          }
          lastCheck = now;
        }
        await page.waitForTimeout(500);
      }
    } else {
      console.log("Notice: End of list not detected after maximum scroll attempts; proceeding with available items.");
    }

    // Initialize an array to store scraped wishlist items.
    console.log("Step 8: Gathering wishlist item details...");
    const items: WishlistItem[] = [];

    // Select all wishlist item containers (div elements with IDs containing "itemInfo_").
    const itemElements = await page.$$('div[id*="itemInfo_"]');
    console.log(`Status: ${itemElements.length} item(s) found in the wishlist.`);

    // Iterate through each wishlist item element to extract data.
    for (const itemElement of itemElements) {
      let itemName = "";
      let manufacturer = "";
      const options: string[] = [];
      let productLink = "";
      let nonAmazonLink = "";

      // Check if the item uses a NON_ASIN structure.
      const nonAsinElement = await itemElement.$('div[data-csa-c-item-id*="NON_ASIN"]');
      if (nonAsinElement) {
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
        // For standard items, extract item name and product link from the anchor element.
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
              console.error("Error: Problem parsing the product URL. Skipping this item.", href);
            }
          }
        }
        // Extract manufacturer information from the byline element.
        const bylineElem = await itemElement.$('span[id*="item-byline-"]');
        if (bylineElem) {
          manufacturer = (await bylineElem.innerText()).trim();
        }
        // Extract all option details from elements with ID "twisterText".
        const twisterElems = await itemElement.$$('span#twisterText');
        for (const twisterElem of twisterElems) {
          const option = (await twisterElem.innerText()).trim();
          if (option) {
            options.push(option);
          }
        }
      }

      if (itemName || productLink || nonAmazonLink) {
        console.log(`Detail: Item scraped - Name: "${itemName}", Manufacturer: "${manufacturer}"`);
        items.push({ itemName, manufacturer, options, productLink, nonAmazonLink });
      }
    }

    // For each scraped item, attempt to fetch a "real" product URL from DuckDuckGo unless already provided.
    console.log("Step 9: Verifying product URLs via DuckDuckGo (if needed)...");
    for (const item of items) {
      if (item.nonAmazonLink) continue;
      const optionsQuery = item.options.join(" ");
      const searchQuery = `${item.itemName} ${optionsQuery}`.trim();
      const queryEncoded = encodeURIComponent(searchQuery);
      const duckUrl = `https://duckduckgo.com/?t=h_&q=official+site+${queryEncoded}++-site%3Aamazon.*&t=h_&ia=web`;
      console.log(`Info: Searching for a verified product URL for "${item.itemName}"...`);
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
            console.log(`Success: Found verified URL for "${item.itemName}".`);
          }
        }
      } catch (e) {
        console.log(`Notice: No verified URL found for "${item.itemName}".`);
      }
    }

    // Determine the maximum number of options across all items to generate CSV headers.
    const maxOptions = items.reduce((max, item) => Math.max(max, item.options.length), 0);

    // Build CSV header columns including dynamic option columns.
    const headerColumns = ["Item Name", "Manufacturer", "Product Link", "Non-Amazon Link"];
    for (let i = 1; i <= maxOptions; i++) {
      headerColumns.push(`Option ${i}`);
    }
    const csvRows = [headerColumns.map(escapeCSV).join(",")];

    // Build CSV rows for each wishlist item.
    console.log("Step 10: Preparing data for CSV export...");
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

    // Write the CSV data to a file named after the wishlist.
    const csvData = csvRows.join("\n");
    const outputFilePath = path.join(process.cwd(), `${wishlistName}.csv`);
    fs.writeFileSync(outputFilePath, csvData, "utf8");
    console.log(`Final Step: Successfully saved your wishlist data to "${outputFilePath}".`);
  }

  console.log("All tasks completed. Closing browser and ending session.");
  // Final wait to ensure any pending operations complete, then close the browser.
  await browser.close();
}

main().catch((err) => console.error("Unhandled error encountered:", err));
