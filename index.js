const puppeteer = require('puppeteer');

const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXEC_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--headless'],
    headless: true,
});

const page = await browser.newPage();
// ... other initialization code if necessary
