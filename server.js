// server.js
const express = require("express");
const ftp = require("basic-ftp");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

const FTP_SERVER = process.env.FTP_SERVER;
const FTP_USERNAME = process.env.FTP_USERNAME;
const FTP_PASSWORD = process.env.FTP_PASSWORD;

// Middleware to parse JSON
app.use(express.json());

// Function to list files on the FTP server
async function listFiles() {
    const client = new ftp.Client();
    let fileList;

    try {
        await client.access({
            host: FTP_SERVER,
            user: FTP_USERNAME,
            password: FTP_PASSWORD,
        });

        console.log("Connected to FTP server.");
        fileList = await client.list();
    } catch (err) {
        console.error("Error connecting to FTP server:", err);
        throw err;
    } finally {
        client.close();
    }

    return fileList;
}

// Route to get the list of files and folders
app.get("/", async (req, res) => {
    try {
        const fileList = await listFiles();

        // Render the file list in HTML
        let html = "<h1>Files and Folders</h1><ul>";
        fileList.forEach(item => {
            html += `<li>
                        ${item.name} 
                        <a href="/download/${encodeURIComponent(item.name)}">Download</a>
                     </li>`;
        });
        html += "</ul><h2>Upload File from URL</h2>
                 <form action='/upload' method='POST'>
                    <input type='text' name='url' placeholder='Enter Direct Download Link' required />
                    <button type='submit'>Upload</button>
                 </form>";
        res.send(html);
    } catch (err) {
        res.status(500).send("Error retrieving files.");
    }
});

// Route to download a file from the FTP server
app.get("/download/:filename", async (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    const client = new ftp.Client();

    try {
        await client.access({
            host: FTP_SERVER,
            user: FTP_USERNAME,
            password: FTP_PASSWORD,
        });

        console.log("Connected to FTP server.");
        const fileStream = await client.downloadToBuffer(filename);

        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Type", "application/octet-stream");
        res.send(fileStream);
    } catch (err) {
        console.error("Error downloading file:", err);
        res.status(500).send("Error downloading file.");
    } finally {
        client.close();
    }
});

// Route to upload a file from a direct download link
app.post("/upload", async (req, res) => {
    const { url } = req.body;

    try {
        // Download the file from the provided URL
        const response = await axios.get(url, { responseType: "arraybuffer" });
        const fileName = path.basename(url);

        // Save to the FTP server
        const client = new ftp.Client();
        await client.access({
            host: FTP_SERVER,
            user: FTP_USERNAME,
            password: FTP_PASSWORD,
        });

        console.log("Connected to FTP server. Uploading file...");
        await client.uploadFrom(Buffer.from(response.data), fileName);

        res.send(`File uploaded successfully: <a href="/">Go back</a>`);
    } catch (err) {
        console.error("Error uploading file:", err);
        res.status(500).send("Error uploading file.");
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
