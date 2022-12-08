import fs from 'fs';
import path from 'path';
import processs from 'process';
import fetch from 'node-fetch';
import { parse } from 'csv-parse';

// URLs CSV fiel location
const URLS_CSV_FILE = path.join(processs.cwd(), 'urls.csv');

// URLs CSV row format
const URLS_CSV_HEADERS = ['tag', 'url'];
type UrlData = {
  tag: string;
  url: string;
}

// URL Regular Expressions
const VALID_CODE_URL_RE = new RegExp('^https:\/\/secretsanta\.cadbury\.co\.uk\/code\/.*$');
const MISSED_OUT_URL_RE = new RegExp('^https:\/\/secretsanta\.cadbury\.co\.uk\/missed-out.*$');

// Validate code URL
const isValidCodeUrl = async (urlToValidate: string) => {
  return VALID_CODE_URL_RE.test(urlToValidate);
}

// Check URL is available
const isCodeUrlAvailable = async (initialUrl: string) => {
  // Validate URL
  if (!await isValidCodeUrl(initialUrl)) {
    throw new Error(`Invalid URL: ${initialUrl}`);
  }

  // Request URL without redirect
  const response1 = await fetch(initialUrl, { redirect: 'manual' });

  // Check for invalid status header
  if (response1.status !== 301 && response1.status !== 302) {
    console.error(`Unexpected status header`);
    console.dir(response1);

    return false;
  }

  // Get location header
  const response1Location = response1.headers.get('location');

  // Check for missing location header
  if (typeof response1Location !== 'string') {
    console.error('Missing location header');
    console.dir(response1);

    return false;
  }

  // Check for 'missed out' location header
  if (MISSED_OUT_URL_RE.test(response1Location)) {
    return false;
  }

  // All checks passed
  return true;
}

// Repeatedly check URL is available
const isCodeUrlAvailableLoop = async (tag: string, initialUrl: string) => {
  // Validate URL
  if (!await isValidCodeUrl(initialUrl)) {
    throw new Error(`Invalid URL: ${initialUrl}`);
  }

  // Store stats for URL
  let previousStatus: boolean | null = null;
  let previousStatusChangeTime: number = new Date().getTime();

  // Repeatedly check URL
  while (true) {
    // Get current URL status
    const newStatus: boolean = await isCodeUrlAvailable(initialUrl);
    const timeNow: number = new Date().getTime();

    // Check for status change
    if (newStatus !== previousStatus) {
      if (newStatus) {
        // URL is available
        if (previousStatus === null) {
          // First status change
          console.log(`${tag} is available! ${initialUrl}`);
        } else {
          // Subsequent status changes
          console.log(`${tag} is now available after ${timeNow - previousStatusChangeTime}ms! ${initialUrl}`);
        }
      } else {
        // URL is unavailable
        if (previousStatus === null) {
          // First status change
          console.log(`${tag} is unavailable.`);
        } else {
          // Subsequent status changes
          console.log(`${tag} is no longer available. Was available for ${timeNow - previousStatusChangeTime}ms.`);
        }
      }

      // Update URL status
      previousStatus = newStatus;
      previousStatusChangeTime = timeNow;
    }
  }
}

// URLs CSV file parser
const parser = parse(
  {
    delimiter: ',',
    comment: '#',
    columns: URLS_CSV_HEADERS
  },
  (error, data: UrlData[]) => {
    // Handle data error
    if (error) {
      console.error(error);

      return;
    }

    // Run check available loop for each URL
    data.forEach(async (urlData: UrlData) => {
      try {
        await isCodeUrlAvailableLoop(urlData.tag, urlData.url);
      } catch (error) {
        // Handle errors thrown
        console.error(error);
      }
    })
  });

// Pipe URLs CSV file to parser
fs.createReadStream(URLS_CSV_FILE).pipe(parser);
