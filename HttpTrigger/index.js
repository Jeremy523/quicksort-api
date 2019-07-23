const Promise = require("bluebird");
const base64js = require("base64-js");
const createHandler = require("azure-function-express").createHandler;
const express = require("express");
const https = require("https");
const qs = require("querystring");
const config = require("./config");

const app = express();

app.use(require('morgan')('combined'));
app.use(require('body-parser').urlencoded({ "extended": true }));

app.post("/api/url", (req, res) => {
    let url = req.body.url;
    let method = req.query.method;
    let analysisFn = null;

    if (url === undefined || method === undefined) {
        res.status(400).send();
        return;
    }

    switch (method) {
        case "analyze":
            analysisFn = postAnalyzeUrl;
            break;
        case "detect":
            analysisFn = postDetectUrl;
            break;
        case "describe":
            analysisFn = postDescribeUrl;
            break;
    }

    if (analysisFn === null) {
        res.status(400).send();
        return;
    }

    analysisFn(url)
        .then(response => {
            res.status(200).json(response);
        })
        .catch(err => {
            res.status(500).json(err);
        });
});

app.post("/api/base64", (req, res) => {
    let base64 = req.body.base64;
    let method = req.query.method;
    let analysisFn = null;

    if (base64 === undefined) {
        res.status(400).send();
        return;
    }

    switch (method) {
        case "analyze":
            analysisFn = postAnalyzeBase64;
            break;
        case "detect":
            analysisFn = postDetectBase64;
            break;
        case "describe":
            analysisFn = postDescribeBase64;
            break;
    }

    if (analysisFn === null) {
        res.status(400).send();
        return;
    }

    analysisFn(base64)
        .then(response => {
            res.status(200).json(response);
        })
        .catch(err => {
            res.status(500).json(err);
        });;
});

const postAnalyzeUrl = imageUrl => {
    const { analyzePath } = config.api;
    let payload = JSON.stringify({
        url: imageUrl
    });
    let params = qs.stringify({
        visualFeatures: "Categories",
        language: "en"
    });
    let contentType = "application/json";
    return postCognitiveSvc(analyzePath, payload, contentType, params);
};
const postAnalyzeBase64 = data => {
    const { analyzePath } = config.api;
    let payload = new Buffer(base64js.toByteArray(data));
    let params = qs.stringify({
        visualFeatures: "Categories",
        language: "en"
    });
    let contentType = "application/octet-stream"
    return postCognitiveSvc(analyzePath, payload, contentType, params);
};

const postDescribeUrl = imageUrl => {
    const { describePath } = config.api;
    let payload = JSON.stringify({
        url: imageUrl
    });
    let params = qs.stringify({
        maxCandidates: 1,
        language: "en"
    });
    let contentType = "application/json";
    return postCognitiveSvc(describePath, payload, contentType, params);
};
const postDescribeBase64 = data => {
    const { describePath } = config.api;
    let payload = new Buffer(base64js.toByteArray(data));
    let params = qs.stringify({
        maxCandidates: 1,
        language: "en"
    });
    let contentType = "application/octet-stream";
    return postCognitiveSvc(describePath, payload, contentType, params);
};

const postDetectUrl = imageUrl => {
    const { detectPath } = config.api;
    let payload = JSON.stringify({
        url: imageUrl
    });
    let contentType = "application/json";
    return postCognitiveSvc(detectPath, payload, contentType, null);
};
const postDetectBase64 = data => {
    const { detectPath } = config.api;
    let payload = new Buffer(base64js.toByteArray(data));
    let contentType = "application/octet-stream";
    return postCognitiveSvc(detectPath, payload, contentType, null);
};

// general helper method to send posts to the computer vision API
const postCognitiveSvc = (apiMethodPath, payload, contentType, params) => {
    return new Promise(resolve => {
        const { key, host } = config.api;

        let path = params ? `${apiMethodPath}/?${params}` : apiMethodPath;

        let options = {
            method: "post",
            host, path,
            headers: {
                "Accept": "*/*",
                "accept-encoding": "gzip, deflate",
                "Cache-control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": contentType,
                "Content-Length": Buffer.byteLength(payload),
                "Host": host,
                "Ocp-Apim-Subscription-Key": key
            }
        };

        let req = https.request(options, res => {
            let data = '';
            res.on("data", chunk => {
                data += chunk;
            });
            res.on("end", () => {
                resolve(JSON.parse(data));
            });
            res.on("error", err => {
                console.log(`ERROR ${res.statusCode}: ${err}`);
            });
        });

        req.write(payload);
        req.end();

    });
};

module.exports = createHandler(app);
