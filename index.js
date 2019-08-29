const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const { webhookURL } = require('./config.json');

const lastDealDataFilePath = path.resolve(__dirname, 'lastDeal.json');

const currentDate = new Date().toISOString();

function executeWebhook(webhook, message) {
  return axios.post(webhook, {
    content: message,
  });
}

function saveDealDataToFile(deal) {
  fs.writeFileSync(lastDealDataFilePath, JSON.stringify(deal));
}

async function sendNotification(message) {
  try {
    if (Array.isArray(webhookURL)) {
      const executingWebhooks = [];
      webhookURL.forEach((webhook) => {
        executingWebhooks.push(executeWebhook(webhook, message));
      });
      await Promise.all(executingWebhooks);
    } else {
      await executeWebhook(webhookURL, message);
    }
  } catch (error) {
    console.error(currentDate, error);
  }
}

(async () => {
  try {
    const website = await axios.get('https://www.morele.net/');
    const $ = cheerio.load(website.data);

    const productName = $('.prom-box-top > a')[0].attribs.title;
    const productUrl = $('.prom-box-top > a')[0].attribs.href;
    const oldPrice = $('.promo-box-old-price').text();
    const newPrice = $('.promo-box-new-price').text();
    const promoCode = $('.promo-box-code-value').text();
    const left = $('.status-box-was').text();
    const sold = $('.status-box-expired').text();

    const oldPriceAsNumber = parseInt(oldPrice.replace(/ /g, '').slice(0, -2), 10);
    const newPriceAsNumber = parseInt(newPrice.replace(/ /g, '').slice(0, -2), 10);
    const priceDifference = oldPriceAsNumber - newPriceAsNumber;

    // eslint-disable-next-line prefer-template
    const message = `**${productName}**\n`
      + `Stara cena: ${oldPrice}\n`
      + `Nowa cena: ${newPrice}\n`
      + `Oszczędzasz: ${priceDifference} zł\n`
      + `Kod promocyjny: ${promoCode}\n`
      + `${left}\n`
      + `${sold}\n`
      + productUrl;

    if (fs.existsSync(lastDealDataFilePath)) {
      const lastDealData = JSON.parse(fs.readFileSync(lastDealDataFilePath));
      if (lastDealData.promoCode !== promoCode && lastDealData.productUrl !== productUrl) {
        sendNotification(message);
        saveDealDataToFile({ productName, productUrl, promoCode });
      }
    } else {
      sendNotification(message);
      saveDealDataToFile({ productName, productUrl, promoCode });
    }
  } catch (error) {
    console.error(currentDate, error);
  }
})();
