import fs from "fs";
import path from "path";
import { createCanvas, loadImage } from "canvas";

// Get the directory path from command line arguments
const directoryPath = process.argv[2];

// Function to check if a file is an image
function isImageFile(filename) {
  const supportedExtensions = [".png", ".jpg"];
  const extension = path.extname(filename).toLowerCase();
  return supportedExtensions.includes(extension);
}

// Function to analyze image pixels and create color data
//MARK: ANALYZE
async function analyzeImage(imagePath) {
  const image = await loadImage(imagePath);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, image.width, image.height);
  const imageData = ctx.getImageData(0, 0, image.width, image.height);
  const pixels = imageData.data;

  const colorMap = new Map();
  const colorData = [];
  const pixelData = [];

  let pixelSize = 1;

  // Detect the pixel size based on the first non-transparent pixel
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const index = (y * image.width + x) * 4;
      const a = pixels[index + 3];

      if (a !== 0) {
        // Found a non-transparent pixel
        let maxGroupSize = Math.min(image.width - x, image.height - y);

        while (pixelSize < maxGroupSize) {
          let isGrouping = true;

          // Check if all pixels within the group have the same color
          for (let i = 0; i < pixelSize; i++) {
            for (let j = 0; j < pixelSize; j++) {
              const neighborIndex = ((y + i) * image.width + (x + j)) * 4;
              if (!compareColors(pixels, index, neighborIndex)) {
                isGrouping = false;
                break;
              }
            }
            if (!isGrouping) {
              break;
            }
          }

          if (isGrouping) {
            pixelSize++;
          } else {
            break;
          }
        }

        // Exit the loop after detecting the pixel size
        y = image.height;
        break;
      }
    }
  }

  // Iterate based on the detected pixel size
  for (let y = 0; y < image.height; y += Math.max(pixelSize - 1, 1)) {
    for (let x = 0; x < image.width; x += Math.max(pixelSize - 1, 1)) {
      const index = (y * image.width + x) * 4;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const a = pixels[index + 3];

      // Skip transparent pixels (alpha value of 0)
      if (a === 0) {
        continue;
      }

      const color = `${r},${g},${b},${a}`;

      if (!colorMap.has(color)) {
        colorMap.set(color, colorData.length);
        colorData.push({ r, g, b, a });
      }

      pixelData.push({ x, y, color });
    }
  }

  return {
    colorData,
    pixelData,
    width: image.width,
    height: image.height,
    pixelSize: Math.max(pixelSize - 1, 1),
  };
}

// Helper function to compare colors of two pixels
function compareColors(pixels, index1, index2) {
  for (let i = 0; i < 4; i++) {
    if (pixels[index1 + i] !== pixels[index2 + i]) {
      return false;
    }
  }
  return true;
}

// Function to create a palette image from color data
function createPaletteImage(colorData) {
  const tileSize = 16;
  const paletteWidth = colorData.length * tileSize;
  const paletteHeight = tileSize;

  const canvas = createCanvas(paletteWidth, paletteHeight);
  const ctx = canvas.getContext("2d");

  colorData.forEach((color, index) => {
    ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${
      color.a / 255
    })`;
    ctx.fillRect(index * tileSize, 0, tileSize, tileSize);
  });

  return canvas.toBuffer();
}

// Function to save color data as CSV
function saveColorDataAsCSV(colorData, csvPath) {
  const csvHeader = "r,g,b,a\n";
  const csvRows = colorData
    .map((color) => `${color.r},${color.g},${color.b},${color.a}`)
    .join("\n");
  const csvContent = csvHeader + csvRows;

  fs.writeFileSync(csvPath, csvContent);
}

// Function to save pixel data as JSON
// MARK: Save JSON
function savePixelDataAsJSON(
  pixelData,
  jsonPath,
  width,
  height,
  pixelSize,
  palette
) {
  const jsonContent = JSON.stringify(
    { width, height, pixelSize, pixels: pixelData, palette },
    null,
    2
  );
  fs.writeFileSync(jsonPath, jsonContent);
  return jsonContent;
}

//MARK: Use by API
export async function imageToJson(image, directoryPath, filename) {
  const { colorData, pixelData, width, height, pixelSize } = await analyzeImage(
    image
  );

  const jsonPath = path.join(directoryPath, `${filename}_pixels.json`);
  const paletteImagePath = path.join(directoryPath, `${filename}_palette.png`);
  const paletteImageBuffer = createPaletteImage(colorData);
  fs.writeFileSync(paletteImagePath, paletteImageBuffer);
  // Read the image file into memory
  const imageBuffer = fs.readFileSync(paletteImagePath);

  // Convert the image to a base64 string
  const base64Image = imageBuffer.toString("base64");

  const resultJSON = savePixelDataAsJSON(
    pixelData,
    jsonPath,
    width,
    height,
    pixelSize,
    base64Image
  );

  return resultJSON;
}

// Read files from the directory
// MARK: Read Files
export async function parseImages() {
  fs.readdir(directoryPath, async (err, files) => {
    if (err) {
      console.error("Error reading directory:", err);
      return;
    }

    for (const file of files) {
      if (isImageFile(file)) {
        const imagePath = path.join(directoryPath, file);
        const { colorData, pixelData, width, height, pixelSize } =
          await analyzeImage(imagePath);

        const paletteImagePath = path.join(
          directoryPath,
          `${path.parse(file).name}_palette.png`
        );
        const paletteImageBuffer = createPaletteImage(colorData);
        fs.writeFileSync(paletteImagePath, paletteImageBuffer);

        const csvPath = path.join(
          directoryPath,
          `${path.parse(file).name}_colors.csv`
        );
        saveColorDataAsCSV(colorData, csvPath);

        const jsonPath = path.join(
          directoryPath,
          `${path.parse(file).name}_pixels.json`
        );
        savePixelDataAsJSON(pixelData, jsonPath, width, height, pixelSize);

        //
        const jsonData = JSON.parse(
          fs.readFileSync(
            `${directoryPath}\\${path.parse(file).name}_pixels.json`,
            "utf-8"
          )
        );

        //createGLTFModel(jsonData.pixels, jsonData.width, jsonData.height);
        // const gltfPath = path.join(
        //   directoryPath,
        //   `${path.parse(file).name}.gltf`
        // );

        // const writer = new GLTFWriter();
        // const gltfData = await writer.writeJSON(gltfDoc);
        // fs.writeFileSync(gltfPath, JSON.stringify(gltfData, null, 2));
      }
    }
  });
}
