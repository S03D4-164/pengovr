#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
};

const downloadDatabases = async () => {
  try {
    console.log('Downloading MaxMind IP databases...');
    
    const COUNTRY_DB = '/tmp/ip-to-country.mmdb';
    const ASN_DB = '/tmp/ip-to-asn.mmdb';
    
    try {
      // MaxMind GeoLite2 Countryデータベースをダウンロード
      await downloadFile(
        'https://media.githubusercontent.com/media/iplocate/ip-address-databases/main/ip-to-country/ip-to-country.mmdb',
        COUNTRY_DB
      );
      console.log('Country database downloaded successfully');
    } catch (error) {
      console.error('Failed to download country database:', error);
    }
    
    try {
      // MaxMind ASNデータベースをダウンロード
      await downloadFile(
        'https://media.githubusercontent.com/media/iplocate/ip-address-databases/main/ip-to-asn/ip-to-asn.mmdb',
        ASN_DB
      );
      console.log('ASN database downloaded successfully');
    } catch (error) {
      console.error('Failed to download ASN database:', error);
    }
    
    console.log('MaxMind databases download completed!');
  } catch (error) {
    console.error('Database download failed:', error);
  }
};

downloadDatabases();
