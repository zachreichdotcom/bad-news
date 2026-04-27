const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const app = express();
app.use(express.static('public'));

app.get('/', async (req, res) => {
    console.log('Fetching the latest NYT front page...');
    
    // CLOUD OPTIMIZED BROWSER LAUNCH
    const browser = await puppeteer.launch({ 
        headless: 'new',
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
        args:[
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    
    try {
        await page.goto('https://www.nytimes.com/', { waitUntil: 'networkidle2', timeout: 60000 });

        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0; let distance = 400;
                let timer = setInterval(() => {
                    window.scrollBy(0, distance); totalHeight += distance;
                    if(totalHeight >= 4000){ clearInterval(timer); window.scrollTo(0, 0); resolve(); }
                }, 100);
            });
        });

        const modifiedHTML = await page.evaluate(() => {
            document.querySelectorAll('script').forEach(s => s.remove());
            
            const junkElements = document.querySelectorAll(`footer, nav, #site-index,[data-testid="site-index"], .site-index,[data-testid="ad-container"],[class*="ad-"], #top-wrapper,[id^="dfp-ad"],[data-testid="masthead-mini"]`);
            junkElements.forEach(el => el.remove());

            const cutoffY = 4000;
            const allElements = document.body.getElementsByTagName('*');
            for (let i = allElements.length - 1; i >= 0; i--) {
                const el = allElements[i];
                const rect = el.getBoundingClientRect();
                if (rect.top > cutoffY || rect.left < -1000) el.remove();
            }

            document.querySelectorAll('a').forEach(a => {
                a.removeAttribute('href');
                a.removeAttribute('target'); 
            });

            const headers = document.querySelectorAll('header, [id*="masthead"],[class*="masthead"],[data-testid*="masthead"], #site-header');
            headers.forEach(h => h.setAttribute('data-remix-ignore', 'true'));

            const base = document.createElement('base');
            base.href = 'https://www.nytimes.com/';
            document.head.prepend(base);

            const link = document.createElement('link');
            link.rel = 'stylesheet'; link.href = '/magic.css'; // Changed to relative path
            document.head.appendChild(link);

            const script = document.createElement('script');
            script.src = '/magic.js'; // Changed to relative path
            document.body.appendChild(script);

            return document.documentElement.outerHTML;
        });

        await browser.close();
        res.send(modifiedHTML);
        console.log('Page served successfully!');
    } catch (error) {
        console.error("Scraping error:", error);
        await browser.close();
        res.status(500).send("An error occurred while fetching the page.");
    }
});

// CLOUD PORT CONFIGURATION
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));