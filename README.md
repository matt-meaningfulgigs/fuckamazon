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
- **Multiple Wishlists:** Accepts multiple public wishlist URLs (comma separated) for batch processing.
- **CAPTCHA Handling:** Automatically detects CAPTCHA challenges by checking for the text "Enter the characters you see below." If detected, the tool takes a screenshot of the CAPTCHA container, converts it to ASCII art, displays it in your terminal, and prompts you to enter the CAPTCHA solution.

## Installation

### Prerequisites

- **Node.js:** Ensure Node.js is installed on your system.
- **GraphicsMagick:** The tool uses the `image-to-ascii` package, which requires GraphicsMagick for image conversion.  
  - **macOS:** Install via Homebrew:  
    ```bash
    brew install graphicsmagick
    ```
  - **Ubuntu/Debian:**  
    ```bash
    sudo apt-get install graphicsmagick
    ```
  - **Windows:** Download and install from the [GraphicsMagick website](http://www.graphicsmagick.org/).

### Clone the Repository

```bash
git clone https://github.com/whateveraccountwhocares/fuckamazon.git
cd fuckamazon
```

### Install Dependencies

```bash
npm install
```

## Usage

Run the scraper with:

```bash
npm start
```

You'll be prompted to enter your Amazon wishlist URL(s) (comma separated, public wishlists only). For each wishlist, the tool may prompt you to input the CAPTCHA text. Sometimes it happens, sometimes not. 

## Contributing

Fork the repo and make it your own. I don't care. Steal it. 
