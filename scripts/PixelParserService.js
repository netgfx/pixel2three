import express from "express";
import cors from "cors";
import multer from "multer";
// functions
import { imageToJson } from "./PixelParser.js";
///

const upload = multer({ dest: "uploads/" }); // 'uploads/' is the directory where images will be stored

import fs from "fs";
const dir = "./uploads";

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);
}

const app = express();
const port = 3002;

app.use(cors());

app.post("/parse-image", upload.single("image"), async (req, res) => {
  const image = req.file;

  if (!image) {
    return res.status(400).json({ error: "URL is required" });
  }

  const resultJSON = await imageToJson(
    image.path,
    image.destination,
    image.originalname
  );

  console.log("image file: ", image);
  res.status(200).json({ data: JSON.parse(resultJSON) });
  try {
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: `Error scraping metadata ${JSON.stringify(error)}` });
  }
});

app.listen(port, () => {
  console.log(`OG metadata API listening at http://localhost:${port}`);
});
