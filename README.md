# FuckAmazon

## Overview

**FuckAmazon** is a tool to help you reclaim your data from an evil corporate machine that backs fascism. It scrapes your Amazon wishlists—extracting item names, manufacturers, options, and product links—and exports everything to a CSV file. If you're fed up with Amazon’s oppressive practices and ready to sever ties, backup your **public** wishlist data now and support honest manufacturers directly.

*Note: This tool works with public wishlists only.*

## Why We Fuck Amazon

Amazon isn't just greedy—it props up fascist structures and crushes small businesses.  
- **Boycott:** Save your data, then delete your Amazon account.  
- **Direct Support:** Use the CSV to purchase directly from makers outside the system.  
- **Resist Fascism:** Every purchase away from Amazon is a strike against corporate tyranny.

## Features

- **Wishlist Scraping:** Extracts item names, manufacturers, and options.
- **Amazon URL Conversion:** Cleans up raw Amazon links in case you unfortunately have no choice.
- **Alternative Lookup:** Uses DuckDuckGo to fetch genuine non-Amazon product links.
- **CSV Export:** Backs up your wishlist data for offline control.
- **Dynamic File Naming:** Uses the wishlist name (from the element `//span[@id="profile-list-name"]`) to name the CSV file.
- **Multiple Wishlists:** Accepts multiple public wishlist URLs (comma separated) for batch processing.

## Installation

1. **Clone the Repository:**

   ```bash
   git clone https://github.com/mmeling/fuckamazon.git
   cd fuckamazon
   ```

2. **Install Dependencies:**

   Make sure you have Node.js installed, then run:

   ```bash
   npm install
   ```

## Usage

Run the scraper with:

```bash
npm start
```

You'll be prompted to enter your Amazon wishlist URL(s) (comma separated, public wishlists only). If you press Enter, the default wishlist URL is used. For each wishlist, the tool will:

- Load the wishlist page.
- Scroll to load all items.
- Scrape item details and convert Amazon links.
- Use DuckDuckGo to attempt fetching a non-Amazon product link.
- Export the data into a CSV file named after the wishlist (e.g. `My_Wishlist_Name.csv`).

## Contributing

Fork the repo and make it your own
