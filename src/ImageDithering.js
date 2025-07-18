import React, { useState, useRef, useEffect } from 'react';

const ImageDithering = () => {
  const [originalImage, setOriginalImage] = useState(null);
  const [ditheredImage, setDitheredImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  // Preset configurations
  const presets = {
    default: {
      name: "Default",
      settings: {
        algorithm: 'floydSteinberg',
        colorDepth: 1,
        palette: 'bw',
        customColors: 8,
        diffusionFactor: 0.75,
        resize: false,
        maxDimension: 400,
        outputFormat: 'png',
        enhanceContrast: false,
        gifQuality: 10
      }
    },
    maxCompression: {
      name: "Maximum Compression",
      settings: {
        algorithm: 'floydSteinberg',
        colorDepth: 1,
        palette: 'bw',
        customColors: 8,
        diffusionFactor: 0.65,
        resize: true,
        maxDimension: 200,
        outputFormat: 'gif',
        enhanceContrast: true,
        gifQuality: 20
      }
    },
    retroGame: {
      name: "Retro Game",
      settings: {
        algorithm: 'ordered',
        colorDepth: 1,
        palette: 'bw',
        customColors: 8,
        diffusionFactor: 0.75,
        resize: false,
        maxDimension: 400,
        outputFormat: 'png',
        enhanceContrast: true,
        gifQuality: 10
      }
    },
    cgaNostalgia: {
      name: "CGA Nostalgia",
      settings: {
        algorithm: 'ordered',
        colorDepth: 1,
        palette: '2bit',
        customColors: 8,
        diffusionFactor: 0.75,
        resize: false,
        maxDimension: 400,
        outputFormat: 'png',
        enhanceContrast: false,
        gifQuality: 10
      }
    },
    newspaper: {
      name: "Newspaper",
      settings: {
        algorithm: 'atkinson',
        colorDepth: 1,
        palette: 'bw',
        customColors: 8,
        diffusionFactor: 0.5,
        resize: false,
        maxDimension: 400,
        outputFormat: 'png',
        enhanceContrast: true,
        gifQuality: 10
      }
    },
    webOptimized: {
      name: "Web Optimized",
      settings: {
        algorithm: 'floydSteinberg',
        colorDepth: 1,
        palette: 'extreme',
        customColors: 8,
        diffusionFactor: 0.75,
        resize: true,
        maxDimension: 600,
        outputFormat: 'webp',
        enhanceContrast: true,
        gifQuality: 10
      }
    },
    pixelArt: {
      name: "Pixel Art",
      settings: {
        algorithm: 'floydSteinberg',
        colorDepth: 2,
        palette: 'custom',
        customColors: 16,
        diffusionFactor: 0.85,
        resize: true,
        maxDimension: 300,
        outputFormat: 'png',
        enhanceContrast: false,
        gifQuality: 10
      }
    }
  };

  const [settings, setSettings] = useState(presets.default.settings);
  const [originalSize, setOriginalSize] = useState(0);
  const [ditheredSize, setDitheredSize] = useState(0);
  const canvasRef = useRef(null);
  const resultCanvasRef = useRef(null);
  const [gifEncoder, setGifEncoder] = useState(null);

  // Initialize GIF.js encoder when component mounts
  useEffect(() => {
    // Check if window.GIF is available (it will be after the script loads)
    if (window.GIF) {
      return; // GIF already loaded
    }

    // Load GIF.js script dynamically
    const script = document.createElement('script');
    script.src = '/gif.js/gif.js';
    script.async = true;
    
    script.onload = () => {
      console.log('GIF.js script loaded');
    };
    
    document.body.appendChild(script);
    
    // Cleanup function to remove the script when component unmounts
    return () => {
      document.body.removeChild(script);
    };
  }, []);

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
    const newValue = (type === 'number' || type === 'range' || 
                     name === 'diffusionFactor' || name === 'colorDepth' || 
                     name === 'customColors' || name === 'gifQuality') 
      ? parseFloat(value) 
      : value;
    
    setSettings({
      ...settings,
      [name]: newValue,
    });
  };

  // Save current settings as a custom preset
  const saveCustomPreset = () => {
    const presetName = prompt("Enter a name for your preset:");
    if (!presetName) return;
    
    // Save to localStorage
    try {
      const savedPresets = JSON.parse(localStorage.getItem('ditherPresets') || '{}');
      savedPresets[presetName] = {
        name: presetName,
        settings: {...settings}
      };
      localStorage.setItem('ditherPresets', JSON.stringify(savedPresets));
      alert(`Preset "${presetName}" saved successfully!`);
    } catch (error) {
      console.error("Error saving preset:", error);
      alert("Failed to save preset. Please try again.");
    }
  };
  
  // Load custom presets from localStorage
  const [customPresets, setCustomPresets] = useState({});
  
  useEffect(() => {
    try {
      const savedPresets = JSON.parse(localStorage.getItem('ditherPresets') || '{}');
      setCustomPresets(savedPresets);
    } catch (error) {
      console.error("Error loading presets:", error);
    }
  }, []);

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
    
    // Handle different output formats
    if (settings.outputFormat === 'gif' && window.GIF) {
      // Create actual GIF using gif.js
      createGif(resultCanvas, width, height);
    } else {
      // Use standard format (PNG or WebP)
      let mimeType = 'image/png';
      let quality = 1.0;
      
      if (settings.outputFormat === 'webp') {
        mimeType = 'image/webp';
        quality = 0.8; // Better compression for webp
      }
      
      setDitheredImage(resultCanvas.toDataURL(mimeType, quality));
      
      // Calculate approximate size
      resultCanvas.toBlob((blob) => {
        setDitheredSize(blob.size);
        setIsProcessing(false);
      }, mimeType, quality);
    }
  };
  
  // Create an actual GIF using gif.js
  const createGif = (canvas, width, height) => {
    // Ensure GIF.js is loaded
    if (!window.GIF) {
      console.error('GIF.js not loaded');
      setIsProcessing(false);
      return;
    }
    
    // Configure GIF encoder
    const gif = new window.GIF({
      workers: 2,
      quality: settings.gifQuality, // 1 is best quality, 30 is fastest
      width: width,
      height: height,
      workerScript: '/gif.js/gif.worker.js',
      transparent: null, // null for no transparency
      background: '#ffffff', // white background
      dither: false // we already applied our own dithering
    });
    
    // Add the frame (just one frame for static image)
    gif.addFrame(canvas, {
      copy: true,
      delay: 0 
    });
    
    // Process the GIF
    gif.on('finished', (blob) => {
      // Create URL for the blob
      const gifUrl = URL.createObjectURL(blob);
      setDitheredImage(gifUrl);
      setDitheredSize(blob.size);
      setIsProcessing(false);
    });
    
    gif.on('progress', (p) => {
      console.log(`GIF encoding progress: ${Math.round(p * 100)}%`);
    });
    
    // Start the GIF rendering
    gif.render();
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
      
      {/* Presets */}
      <div className="w-full max-w-2xl mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-gray-700 text-sm font-bold">
            Presets:
          </label>
          <button
            onClick={saveCustomPreset}
            className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-800 rounded text-xs font-medium transition-colors flex items-center"
          >
            <span>Save Current Settings</span>
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2 justify-center mb-2">
          {Object.keys(presets).map((presetKey) => (
            <button
              key={presetKey}
              onClick={() => setSettings(presets[presetKey].settings)}
              className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded shadow-sm text-sm font-medium transition-colors"
            >
              {presets[presetKey].name}
            </button>
          ))}
        </div>
        
        {Object.keys(customPresets).length > 0 && (
          <div className="mt-3">
            <div className="text-xs text-gray-600 mb-2">Your Saved Presets:</div>
            <div className="flex flex-wrap gap-2 justify-center">
              {Object.keys(customPresets).map((presetKey) => (
                <div key={presetKey} className="relative group">
                  <button
                    onClick={() => setSettings(customPresets[presetKey].settings)}
                    className="px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded shadow-sm text-sm font-medium transition-colors"
                  >
                    {customPresets[presetKey].name}
                  </button>
                  <button
                    onClick={() => {
                      const newPresets = {...customPresets};
                      delete newPresets[presetKey];
                      setCustomPresets(newPresets);
                      localStorage.setItem('ditherPresets', JSON.stringify(newPresets));
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete preset"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
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
              <option value="gif">GIF (Smallest, True GIF)</option>
            </select>
          </div>
          
          {settings.outputFormat === 'gif' && (
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                GIF Quality: {settings.gifQuality} 
                <span className="text-xs text-gray-500 ml-2">(Lower = better quality, higher = smaller size)</span>
              </label>
              <input 
                type="range"
                name="gifQuality"
                min="1"
                max="20"
                step="1"
                value={settings.gifQuality}
                onChange={updateSettings}
                className="w-full"
              />
            </div>
          )}
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
        <p className="mb-4">
          Try our presets for different effects or save your own custom presets. The "Maximum Compression" preset is optimized for the smallest possible file size, while "Pixel Art" and "CGA Nostalgia" create cool retro looks.
        </p>
        <p>
          For extreme file size reduction, use the GIF format with Black & White palette, resize to a smaller dimension, and adjust the GIF quality slider.
        </p>
      </div>
    </div>
  );
};

export default ImageDithering;