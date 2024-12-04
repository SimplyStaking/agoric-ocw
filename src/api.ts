import { Request, NextFunction, Response, RequestHandler } from "express";
import { getRemovedTransactionsSince, getTransactionsSince } from "./lib/db";
import { API_SECRET } from "./config/config";

import express from "express";
const apiRouter = express.Router();

// Middleware to check API key
const checkApiKey: RequestHandler = (req, res, next) => {
    const apiKey = req.headers['api-key'] as string | undefined; // Get the 'api-key' from the request headers
  
    // Check if the 'api-key' is correct
    if (apiKey === API_SECRET) {
        next();
    } else {
        res.status(403).json({ message: 'Forbidden: Invalid API Key' }); // If invalid, send a 403 response
    }
  };

apiRouter.get('/txs', checkApiKey, async (req: Request, res: Response) => {
    let since = req.query.since as string
    if(isNaN(Number(since))){
        res.status(400).json({
            success: false,
            message: "Since parameter must be a number"
        })
    }

    let txs = await getTransactionsSince(Number(since))
    res.status(200).json(txs)
});

apiRouter.get('/reorgedTxs', checkApiKey, async (req: Request, res: Response) => {
    let since = req.query.since as string
    if(isNaN(Number(since))){
        res.status(400).json({
            success: false,
            message: "Since parameter must be a number"
        })
    }

    let txs = await getRemovedTransactionsSince(Number(since))
    res.status(200).json(txs)
});

export default apiRouter;