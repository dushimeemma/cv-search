import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import fs from "fs";
import path from "path";
import readline from "readline";
import { parse } from "url";
import { parse as parseQuery } from "querystring";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const TOKEN_PATH = path.join(__dirname, "../token.json");
const CREDENTIALS_PATH = path.join(__dirname, "../credentials.json");

const readJsonFile = (filePath: string): any => {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error reading or parsing ${filePath}:`, error);
    return null;
  }
};

export const authenticate = async (): Promise<OAuth2Client> => {
  const credentials = readJsonFile(CREDENTIALS_PATH);
  if (!credentials) {
    throw new Error("Failed to load credentials.json");
  }

  const { client_secret, client_id, redirect_uris } = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  const token = readJsonFile(TOKEN_PATH);
  if (token) {
    oAuth2Client.setCredentials(token);
  } else {
    await getAccessToken(oAuth2Client);
  }

  return oAuth2Client;
};

const getAccessToken = (oAuth2Client: OAuth2Client) => {
  return new Promise<void>((resolve, reject) => {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: SCOPES,
    });
    console.log("Authorize this app by visiting this url:", authUrl);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("Enter the URL you were redirected to: ", (url) => {
      rl.close();
      const parsedUrl = parse(url);
      const queryParams = parseQuery(parsedUrl.query || "");
      const code = queryParams.code as string;

      if (!code) {
        return reject(new Error("No authorization code found"));
      }

      oAuth2Client.getToken(code, (err, token) => {
        if (err) return reject(err);
        if (!token) return reject(new Error("Failed to obtain token"));
        oAuth2Client.setCredentials(token);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
        console.log("Token stored to", TOKEN_PATH);
        resolve();
      });
    });
  });
};
