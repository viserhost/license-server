const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(cors());
app.use(express.json());

// Helper to read JSON database
const readDB = () => {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    return { valid_codes: [], activations: [] };
  }
};

// Helper to write JSON database
const writeDB = (data) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing database:', error);
  }
};

app.post('/api/verify-purchase', (req, res) => {
  const { domain, url, purchase_code, product_code, date_time, user_agent, language } = req.body;
  const db = readDB();

  if (!domain) {
    return res.status(400).json({ success: false, message: "Domain is required" });
  }

  if (!product_code) {
    return res.status(400).json({ success: false, message: "Product code is required" });
  }

  // Case 1: Checking if domain is already activated (when app reloads without a purchase code)
  if (!purchase_code) {
    const isActivated = db.activations.find(a => a.domain === domain && a.product_code === product_code);
    if (isActivated) {
      return res.json({ success: true, message: "Domain is verified" });
    } else {
      return res.json({ success: false, message: "Domain not verified" });
    }
  }

  // Case 2: Activating with a purchase code (when user submits the modal)
  // Check if code is valid for this product
  const validCodeObj = db.valid_codes.find(c => c.code === purchase_code && c.product_code === product_code);
  
  if (!validCodeObj) {
    return res.json({ success: false, message: "Invalid purchase code for this product" });
  }

  // Check if the purchase code is active
  if (validCodeObj.is_active === false) {
    return res.json({ success: false, message: "This purchase code has been disabled" });
  }

  // Check if code is already used
  const existingActivation = db.activations.find(a => a.purchase_code === purchase_code);
  
  if (existingActivation) {
    if (existingActivation.domain === domain) {
      // Already activated for this domain
      return res.json({ success: true, message: "Domain already activated with this code" });
    } else {
      // Used by another domain
      return res.json({ success: false, message: "Purchase code is already active on another domain" });
    }
  }

  // Valid code, active, and not used -> Activate it!
  db.activations.push({
    domain,
    url,
    purchase_code,
    product_code,
    client_date_time: date_time,
    user_agent,
    language,
    activated_at: new Date().toISOString()
  });
  
  writeDB(db);

  return res.json({ success: true, message: "License activated successfully!" });
});

app.listen(PORT, () => {
  console.log(`License Server running on http://localhost:${PORT}`);
});
