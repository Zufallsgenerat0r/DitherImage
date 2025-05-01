import React, { useState, useRef } from 'react';

const ImageDithering = () => {
  const [originalImage, setOriginalImage] = useState(null);
  const [ditheredImage, setDitheredImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [settings, setSettings] = useState({
    algorithm: 'floydSteinberg',
    colorDepth: 1, // Bits per color channel
    palette: 'bw', // "bw", "rgb", "custom", "2bit", "extreme"
    customColors: 8,
    diffusionFactor: 0.75,
    resize: false, 
    maxDimension: 400,
    outputFormat: 'png', // png, gif, webp
    enhanceContrast: false
  });
  const [originalSize, setOriginalSize] = useState(0);
  const [ditheredSize, setDitheredSize] = useState(0);
  const canvasRef = useRef(null);
  const resultCanvasRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setOriginalSize(file.size);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setOriginalImage(img);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const updateSettings = (e) => {
    const { name, value, type } = e.target;
    // Make sure we convert range and number inputs to numbers
    const newValue = (type === 'number' || type === 'range' || name === 'diffusionFactor' || name === 'colorDepth' || name === 'customColors') 
      ? parseFloat(value) 
      : value;
    
    setSettings({
      ...settings,
      [name]: newValue,
    });
  };

  const applyDithering = () => {
    if (!originalImage) return;
    
    setIsProcessing(true);
    
    // Draw original image to canvas
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Determine dimensions (apply resize if enabled)
    let width = originalImage.width;
    let height = originalImage.height;
    
    if (settings.resize) {
      const maxDim = settings.maxDimension;
      if (width > height && width > maxDim) {
        height = Math.round(height * (maxDim / width));
        width = maxDim;
      } else if (height > width && height > maxDim) {
        width = Math.round(width * (maxDim / height));
        height = maxDim;
      } else if (width === height && width > maxDim) {
        width = maxDim;
        height = maxDim;
      }
    }
    
    // Set canvas dimensions 
    canvas.width = width;
    canvas.height = height;
    
    // Draw the original image (scaled if resize enabled)
    ctx.drawImage(originalImage, 0, 0, width, height);
    
    // Apply contrast enhancement if enabled
    if (settings.enhanceContrast) {
      const imageData = ctx.getImageData(0, 0, width, height);
      enhanceImageContrast(imageData.data);
      ctx.putImageData(imageData, 0, 0);
    }
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, width, height);
    
    // Apply dithering algorithm based on settings
    const ditheredData = applyDitheringAlgorithm(imageData, settings);
    
    // Create result canvas with same dimensions
    const resultCanvas = resultCanvasRef.current;
    resultCanvas.width = width;
    resultCanvas.height = height;
    
    // Put the dithered image data
    const resultCtx = resultCanvas.getContext('2d');
    resultCtx.putImageData(ditheredData, 0, 0);
    
    // Get the dithered image as data URL in the selected format
    let mimeType = 'image/png';
    let quality = 1.0;
    
    switch(settings.outputFormat) {
      case 'gif':
        mimeType = 'image/gif';
        break;
      case 'webp':
        mimeType = 'image/webp';
        quality = 0.8; // Better compression for webp
        break;
      default: // png
        mimeType = 'image/png';
    }
    
    setDitheredImage(resultCanvas.toDataURL(mimeType, quality));
    
    // Calculate approximate size
    resultCanvas.toBlob((blob) => {
      setDitheredSize(blob.size);
      setIsProcessing(false);
    }, mimeType, quality);
  };
  
  // Helper function to enhance image contrast
  const enhanceImageContrast = (data) => {
    // Find min and max values
    let min = 255;
    let max = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const v = (r + g + b) / 3;
      
      if (v < min) min = v;
      if (v > max) max = v;
    }
    
    // Apply contrast stretching
    const range = max - min;
    if (range <= 0) return;
    
    for (let i = 0; i < data.length; i += 4) {
      for (let j = 0; j < 3; j++) {
        data[i + j] = Math.min(255, Math.max(0, 
          Math.round(((data[i + j] - min) / range) * 255)
        ));
      }
    }
  };

  // Dithering algorithms implementation
  const applyDitheringAlgorithm = (imageData, settings) => {
    const { algorithm, colorDepth, palette, diffusionFactor, customColors } = settings;
    const { data, width, height } = imageData;
    
    // Create a copy of the image data
    const resultData = new Uint8ClampedArray(data);
    
    // Generate color palette
    const colors = generatePalette(palette, colorDepth, customColors);
    
    // Apply the selected algorithm
    switch(algorithm) {
      case 'floydSteinberg':
        floydSteinbergDithering(resultData, width, height, colors, diffusionFactor);
        break;
      case 'ordered':
        orderedDithering(resultData, width, height, colors);
        break;
      case 'atkinson':
        atkinsonDithering(resultData, width, height, colors, diffusionFactor);
        break;
      default:
        floydSteinbergDithering(resultData, width, height, colors, diffusionFactor);
    }
    
    return new ImageData(resultData, width, height);
  };
  
  // Floyd-Steinberg dithering algorithm
  const floydSteinbergDithering = (data, width, height, palette, diffusionFactor) => {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // Get current pixel values
        const oldR = data[idx];
        const oldG = data[idx + 1];
        const oldB = data[idx + 2];
        
        // Find closest color in palette
        const [newR, newG, newB] = findClosestColor([oldR, oldG, oldB], palette);
        
        // Set the new pixel values
        data[idx] = newR;
        data[idx + 1] = newG;
        data[idx + 2] = newB;
        
        // Calculate error
        const errR = oldR - newR;
        const errG = oldG - newG;
        const errB = oldB - newB;
        
        // Distribute error to neighboring pixels (Floyd-Steinberg pattern)
        // Right pixel (7/16)
        if (x + 1 < width) {
          const idx2 = idx + 4;
          data[idx2] = Math.min(255, Math.max(0, data[idx2] + errR * 7/16 * diffusionFactor));
          data[idx2 + 1] = Math.min(255, Math.max(0, data[idx2 + 1] + errG * 7/16 * diffusionFactor));
          data[idx2 + 2] = Math.min(255, Math.max(0, data[idx2 + 2] + errB * 7/16 * diffusionFactor));
        }
        
        // Bottom-left pixel (3/16)
        if (y + 1 < height && x > 0) {
          const idx2 = idx + width * 4 - 4;
          data[idx2] = Math.min(255, Math.max(0, data[idx2] + errR * 3/16 * diffusionFactor));
          data[idx2 + 1] = Math.min(255, Math.max(0, data[idx2 + 1] + errG * 3/16 * diffusionFactor));
          data[idx2 + 2] = Math.min(255, Math.max(0, data[idx2 + 2] + errB * 3/16 * diffusionFactor));
        }
        
        // Bottom pixel (5/16)
        if (y + 1 < height) {
          const idx2 = idx + width * 4;
          data[idx2] = Math.min(255, Math.max(0, data[idx2] + errR * 5/16 * diffusionFactor));
          data[idx2 + 1] = Math.min(255, Math.max(0, data[idx2 + 1] + errG * 5/16 * diffusionFactor));
          data[idx2 + 2] = Math.min(255, Math.max(0, data[idx2 + 2] + errB * 5/16 * diffusionFactor));
        }
        
        // Bottom-right pixel (1/16)
        if (y + 1 < height && x + 1 < width) {
          const idx2 = idx + width * 4 + 4;
          data[idx2] = Math.min(255, Math.max(0, data[idx2] + errR * 1/16 * diffusionFactor));
          data[idx2 + 1] = Math.min(255, Math.max(0, data[idx2 + 1] + errG * 1/16 * diffusionFactor));
          data[idx2 + 2] = Math.min(255, Math.max(0, data[idx2 + 2] + errB * 1/16 * diffusionFactor));
        }
      }
    }
  };
  
  // Ordered dithering (Bayer matrix)
  const orderedDithering = (data, width, height, palette) => {
    // 4x4 Bayer threshold matrix
    const thresholdMap = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5]
    ];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // Get threshold value from Bayer matrix (normalized to 0-1)
        const threshold = (thresholdMap[y % 4][x % 4] / 16) - 0.5;
        
        // Add threshold to original color before quantizing
        const r = Math.min(255, Math.max(0, data[idx] + threshold * 32));
        const g = Math.min(255, Math.max(0, data[idx + 1] + threshold * 32));
        const b = Math.min(255, Math.max(0, data[idx + 2] + threshold * 32));
        
        // Find closest color in palette
        const [newR, newG, newB] = findClosestColor([r, g, b], palette);
        
        // Set the new pixel values
        data[idx] = newR;
        data[idx + 1] = newG;
        data[idx + 2] = newB;
      }
    }
  };
  
  // Atkinson dithering algorithm
  const atkinsonDithering = (data, width, height, palette, diffusionFactor) => {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // Get current pixel values
        const oldR = data[idx];
        const oldG = data[idx + 1];
        const oldB = data[idx + 2];
        
        // Find closest color in palette
        const [newR, newG, newB] = findClosestColor([oldR, oldG, oldB], palette);
        
        // Set the new pixel values
        data[idx] = newR;
        data[idx + 1] = newG;
        data[idx + 2] = newB;
        
        // Calculate error (with 1/8 distribution for each direction)
        const errR = (oldR - newR) * diffusionFactor / 8;
        const errG = (oldG - newG) * diffusionFactor / 8;
        const errB = (oldB - newB) * diffusionFactor / 8;
        
        // Atkinson pattern (distribute to 6 pixels)
        const positions = [
          [1, 0], [2, 0],   // right, 2 right
          [-1, 1], [0, 1], [1, 1],  // left-down, down, right-down
          [0, 2]  // 2 down
        ];
        
        for (const [dx, dy] of positions) {
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nidx = (ny * width + nx) * 4;
            data[nidx] = Math.min(255, Math.max(0, data[nidx] + errR));
            data[nidx + 1] = Math.min(255, Math.max(0, data[nidx + 1] + errG));
            data[nidx + 2] = Math.min(255, Math.max(0, data[nidx + 2] + errB));
          }
        }
      }
    }
  };
  
  // Generate color palette based on settings
  const generatePalette = (paletteType, colorDepth, customColors) => {
    switch(paletteType) {
      case 'bw':
        return [[0, 0, 0], [255, 255, 255]];
      case 'rgb': {
        const colors = [];
        const levels = Math.pow(2, colorDepth);
        const step = 255 / (levels - 1);
        
        for (let r = 0; r < levels; r++) {
          for (let g = 0; g < levels; g++) {
            for (let b = 0; b < levels; b++) {
              colors.push([
                Math.round(r * step),
                Math.round(g * step),
                Math.round(b * step)
              ]);
            }
          }
        }
        return colors;
      }
      case 'custom': {
        // Generate a palette with n custom colors using uniform sampling
        const colors = [];
        // Simple color cube sampling for demo purposes
        const cubeRoot = Math.ceil(Math.pow(customColors, 1/3));
        const step = 255 / (cubeRoot - 1 || 1);
        
        for (let r = 0; r < cubeRoot && colors.length < customColors; r++) {
          for (let g = 0; g < cubeRoot && colors.length < customColors; g++) {
            for (let b = 0; b < cubeRoot && colors.length < customColors; b++) {
              colors.push([
                Math.round(r * step),
                Math.round(g * step),
                Math.round(b * step)
              ]);
            }
          }
        }
        return colors;
      }
      case '2bit': {
        // Classic 4-color CGA/retro palette (black, cyan, magenta, white)
        return [
          [0, 0, 0],       // Black
          [0, 255, 255],   // Cyan
          [255, 0, 255],   // Magenta
          [255, 255, 255]  // White
        ];
      }
      case 'extreme': {
        // 3 color ultra-minimal palette (black, 50% gray, white)
        return [
          [0, 0, 0],         // Black
          [128, 128, 128],   // Gray
          [255, 255, 255]    // White
        ];
      }
      default:
        return [[0, 0, 0], [255, 255, 255]];
    }
  };
  
  // Find the closest color in palette to a given color
  const findClosestColor = (color, palette) => {
    let minDistance = Infinity;
    let closestColor = palette[0];
    
    for (const paletteColor of palette) {
      const distance = colorDistance(color, paletteColor);
      if (distance < minDistance) {
        minDistance = distance;
        closestColor = paletteColor;
      }
    }
    
    return closestColor;
  };
  
  // Calculate color distance (Euclidean distance in RGB space)
  const colorDistance = (color1, color2) => {
    const dr = color1[0] - color2[0];
    const dg = color1[1] - color2[1];
    const db = color1[2] - color2[2];
    return dr*dr + dg*dg + db*db;
  };
  
  const downloadImage = () => {
    if (!ditheredImage) return;
    
    const fileExtension = settings.outputFormat === 'webp' ? 'webp' : 
                         settings.outputFormat === 'gif' ? 'gif' : 'png';
    
    const link = document.createElement('a');
    link.href = ditheredImage;
    link.download = `dithered_image.${fileExtension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format bytes to human-readable size
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Calculate compression ratio
  const getCompressionRatio = () => {
    if (!originalSize || !ditheredSize) return '';
    const ratio = (originalSize / ditheredSize).toFixed(2);
    return `${ratio}:1`;
  };

  return (
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto p-4 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-blue-800">Image Dithering Tool</h1>
      <p className="text-gray-600 mb-6 text-center max-w-2xl">
        Upload an image and apply dithering to reduce file size while maintaining visual quality.
        This tool uses various dithering algorithms to compress your images.
      </p>
      
      {/* Image upload */}
      <div className="w-full max-w-md mb-8">
        <label className="block text-gray-700 text-sm font-bold mb-2">
          Upload Image:
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="w-full border border-gray-300 p-2 rounded"
        />
      </div>
      
      {/* Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl mb-6">
        <div className="p-4 bg-white shadow rounded">
          <h2 className="text-xl font-semibold mb-4">Dithering Settings</h2>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Algorithm:
            </label>
            <select 
              name="algorithm" 
              value={settings.algorithm}
              onChange={updateSettings}
              className="w-full border border-gray-300 p-2 rounded"
            >
              <option value="floydSteinberg">Floyd-Steinberg</option>
              <option value="ordered">Ordered (Bayer)</option>
              <option value="atkinson">Atkinson</option>
            </select>
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Color Palette:
            </label>
            <select 
              name="palette" 
              value={settings.palette}
              onChange={updateSettings}
              className="w-full border border-gray-300 p-2 rounded"
            >
              <option value="bw">Black & White (2 colors)</option>
              <option value="extreme">Ultra Minimal (3 colors)</option>
              <option value="2bit">Classic CGA (4 colors)</option>
              <option value="custom">Custom Palette</option>
              <option value="rgb">RGB Color</option>
            </select>
          </div>
          
          {settings.palette === 'rgb' && (
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Color Depth (bits per channel): {settings.colorDepth}
              </label>
              <input 
                type="range"
                name="colorDepth"
                min="1"
                max="4"
                step="1"
                value={settings.colorDepth}
                onChange={updateSettings}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">
                Total Colors: {Math.pow(Math.pow(2, settings.colorDepth), 3)}
              </div>
            </div>
          )}
          
          {settings.palette === 'custom' && (
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Number of Colors: {settings.customColors}
              </label>
              <input 
                type="range"
                name="customColors"
                min="2"
                max="64"
                step="1"
                value={settings.customColors}
                onChange={updateSettings}
                className="w-full"
              />
            </div>
          )}
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Error Diffusion Factor: {settings.diffusionFactor.toFixed(2)}
            </label>
            <input 
              type="range"
              name="diffusionFactor"
              min="0"
              max="1"
              step="0.05"
              value={settings.diffusionFactor}
              onChange={updateSettings}
              className="w-full"
            />
          </div>
          
          <hr className="my-4" />
          <h3 className="font-bold mb-2 text-red-700">Extreme Compression Options</h3>
          
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="resize"
                checked={settings.resize}
                onChange={(e) => setSettings({...settings, resize: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">Resize Image</span>
            </label>
            
            {settings.resize && (
              <div className="mt-2">
                <label className="block text-gray-700 text-xs mb-1">
                  Max Dimension: {settings.maxDimension}px
                </label>
                <input
                  type="range"
                  name="maxDimension"
                  min="50"
                  max="800"
                  step="50"
                  value={settings.maxDimension}
                  onChange={updateSettings}
                  className="w-full"
                />
              </div>
            )}
          </div>
          
          <div className="mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="enhanceContrast"
                checked={settings.enhanceContrast}
                onChange={(e) => setSettings({...settings, enhanceContrast: e.target.checked})}
                className="mr-2"
              />
              <span className="text-sm">Enhance Contrast</span>
            </label>
          </div>
          
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Output Format:
            </label>
            <select 
              name="outputFormat" 
              value={settings.outputFormat}
              onChange={updateSettings}
              className="w-full border border-gray-300 p-2 rounded"
            >
              <option value="png">PNG (Lossless)</option>
              <option value="webp">WebP (Efficient)</option>
              <option value="gif">GIF (Smallest)</option>
            </select>
          </div>
        </div>
        
        <div className="p-4 bg-white shadow rounded flex flex-col">
          <h2 className="text-xl font-semibold mb-4">Size Comparison</h2>
          
          {originalImage && (
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="mb-2">
                  <span className="font-bold">Original Size:</span> {formatBytes(originalSize)}
                </div>
                
                {ditheredImage && (
                  <>
                    <div className="mb-2">
                      <span className="font-bold">Dithered Size:</span> {formatBytes(ditheredSize)}
                    </div>
                    <div className="mb-2">
                      <span className="font-bold">Size Reduction:</span> {((1 - ditheredSize/originalSize) * 100).toFixed(2)}%
                    </div>
                    <div className="mb-2">
                      <span className="font-bold">Compression Ratio:</span> {getCompressionRatio()}
                    </div>
                  </>
                )}
              </div>
              
              <div className="mt-4">
                <button
                  onClick={applyDithering}
                  disabled={!originalImage || isProcessing}
                  className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400 w-full mb-2"
                >
                  {isProcessing ? 'Processing...' : 'Apply Dithering'}
                </button>
                
                {ditheredImage && (
                  <button
                    onClick={downloadImage}
                    className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 w-full"
                  >
                    Download Dithered Image
                  </button>
                )}
              </div>
            </div>
          )}
          
          {!originalImage && (
            <div className="flex-1 flex items-center justify-center text-gray-500 italic">
              Upload an image to see size comparison
            </div>
          )}
        </div>
      </div>
      
      {/* Image comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-6xl">
        <div className="flex flex-col items-center">
          <h3 className="text-lg font-semibold mb-2">Original Image</h3>
          <canvas 
            ref={canvasRef} 
            className="hidden" 
          />
          {originalImage ? (
            <div className="border border-gray-300 bg-gray-100 p-1 flex items-center justify-center h-64 w-full">
              <img 
                src={originalImage.src} 
                alt="Original" 
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="border border-gray-300 bg-gray-100 p-1 flex items-center justify-center h-64 w-full text-gray-500 italic">
              No image uploaded
            </div>
          )}
        </div>
        
        <div className="flex flex-col items-center">
          <h3 className="text-lg font-semibold mb-2">Dithered Image</h3>
          <canvas 
            ref={resultCanvasRef}
            className="hidden"
          />
          {ditheredImage ? (
            <div className="border border-gray-300 bg-gray-100 p-1 flex items-center justify-center h-64 w-full">
              <img 
                src={ditheredImage} 
                alt="Dithered" 
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="border border-gray-300 bg-gray-100 p-1 flex items-center justify-center h-64 w-full text-gray-500 italic">
              Process an image to see result
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-10 text-sm text-gray-600 max-w-2xl text-center">
        <p>
          Note: For maximum compression, use Black & White palette with Floyd-Steinberg dithering. 
          The downloaded image is in PNG format for quality, but you can convert it to GIF for even smaller file sizes.
        </p>
      </div>
    </div>
  );
};

export default ImageDithering;