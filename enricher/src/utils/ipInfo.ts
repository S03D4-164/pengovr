import logger from './logger.js';
import net from 'net';
import { promises as dns } from 'dns';
import { Reader } from 'maxmind';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';

interface GeoIPInfo {
  country?: string;
  country_long?: string;
  continent_code?: string;
}

interface HostInfo {
  reverse?: string[];
  bgp?: any[]; // BGP情報を格納
  geoip?: GeoIPInfo;
  ip?: string;
}

// データベースファイルのパス
const DB_PATH = '/tmp';
const COUNTRY_DB = join(DB_PATH, 'ip-to-country.mmdb');
const ASN_DB = join(DB_PATH, 'ip-to-asn.mmdb');

let countryReader: Reader<any> | null = null;
let asnReader: Reader<any> | null = null;

// データベースリーダーの初期化
const initReaders = async () => {
  try {
    console.log('Checking for MaxMind databases...');
    console.log('Country DB path:', COUNTRY_DB);
    console.log('ASN DB path:', ASN_DB);

    if (existsSync(COUNTRY_DB)) {
      console.log('Country database file exists, loading...');
      const countryBuffer = readFileSync(COUNTRY_DB);
      countryReader = new Reader(countryBuffer);
      console.log('Country database loaded successfully');
    } else {
      console.log('Country database not found:', COUNTRY_DB);
    }

    if (existsSync(ASN_DB)) {
      console.log('ASN database file exists, loading...');
      const asnBuffer = readFileSync(ASN_DB);
      asnReader = new Reader(asnBuffer);
      console.log('ASN database loaded successfully');
    } else {
      console.log('ASN database not found:', ASN_DB);
    }
  } catch (error) {
    console.error('Failed to load databases:', error);
  }
};

// 初期化
initReaders();

const getIpinfo = async (host: string): Promise<HostInfo | undefined> => {
  try {
    let ip: string | undefined;
    if (net.isIP(host)) {
      ip = host;
    } else {
      // whois.extractIPが無効なため、直接IPアドレスのみを処理
      console.log('Hostname resolution temporarily disabled, using IP only');
      ip = undefined;
    }

    if (!ip) {
      return undefined;
    }

    // DNS逆引き
    let reverses: string[] = [];
    try {
      reverses = await dns.reverse(ip);
    } catch (err) {
      logger.debug('Reverse DNS failed:', err);
    }
    const hostnames = Array.from(new Set(reverses));
    if (hostnames.length > 0) {
      console.log(`Reverse DNS for ${ip}:`, hostnames);
    }

    // GeoIP情報取得
    let geo: GeoIPInfo = {};
    if (countryReader) {
      try {
        const result = countryReader.get(ip);
        if (result) {
          geo = {
            country: result.country_code,
            country_long: result.country_name,
            continent_code: result.continent_code,
          };
          console.log(`GeoIP info for ${ip}:`, geo);
        }
      } catch (error) {
        logger.error('[GeoIP] error:', error);
      }
    }

    // BGP情報取得
    let bgp: any[] = [];
    if (asnReader) {
      try {
        const result = asnReader.get(ip);
        if (result) {
          // BGP情報としてASN情報を格納
          bgp = [
            {
              asn: result.asn,
              name: result.name,
              org: result.org,
              domain: result.domain,
              country: result.country_code,
            },
          ];
          //console.log(`BGP info for ${ip}:`, bgp);
        }
      } catch (error) {
        logger.error('[ASN] error:', error);
      }
    }

    const ipInfo: HostInfo = {
      reverse: hostnames,
      bgp: bgp,
      geoip: geo,
      ip: ip,
    };

    //logger.debug(`IP info for ${ip}:`, ipInfo);
    return ipInfo;
  } catch (err) {
    logger.error('getIpinfo error:', err);
    return undefined;
  }
};

export const getHostInfo = async (host: string): Promise<HostInfo | undefined> => {
  const hostinfo = await getIpinfo(host);
  return hostinfo;
};

// データベースダウンロード関数
export const downloadDatabases = async () => {
  const https = await import('https');
  const fs = await import('fs');

  const downloadFile = (url: string, dest: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      https
        .get(url, (response: any) => {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        })
        .on('error', (err: any) => {
          fs.unlink(dest, () => reject(err));
        });
    });
  };

  try {
    console.log('Downloading IP databases...');
    await downloadFile(
      'https://media.githubusercontent.com/media/iplocate/ip-address-databases/main/ip-to-country/ip-to-country.mmdb',
      COUNTRY_DB,
    );
    await downloadFile(
      'https://media.githubusercontent.com/media/iplocate/ip-address-databases/main/ip-to-asn/ip-to-asn.mmdb',
      ASN_DB,
    );

    // リーダーを再初期化
    await initReaders();
    console.log('Databases downloaded and loaded successfully');
  } catch (error) {
    logger.error('Failed to download databases:', error);
  }
};
