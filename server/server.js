require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { nanoid } = require('nanoid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_FILE = path.join(__dirname, 'data', 'orders.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');

// ---------- middleware ----------
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(__dirname, 'public'))); // serves admin.html

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${Date.now()}-${nanoid(8)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  }
});

// ---------- tiny JSON "database" helpers ----------
function readOrders() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}
function writeOrders(orders) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2));
}

// ---------- admin auth (HTTP Basic) ----------
function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (scheme !== 'Basic' || !encoded) {
    res.set('WWW-Authenticate', 'Basic realm="Z&Z Crochet Admin"');
    return res.status(401).json({ error: 'Authentication required' });
  }
  const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':');
  if (user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASSWORD) return next();
  res.set('WWW-Authenticate', 'Basic realm="Z&Z Crochet Admin"');
  return res.status(401).json({ error: 'Invalid credentials' });
}

// ---------- mailer ----------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE !== 'false',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

function customerEmailHtml(order) {
  const colorChips = (order.paletteHex || '')
    .split(',').map(h => h.trim()).filter(Boolean)
    .map(hex => `<span style="display:inline-block;width:24px;height:24px;border-radius:8px;background:${hex};margin-right:8px;border:2px solid #ffffff;box-shadow:0 2px 6px rgba(74,63,58,0.18);"></span>`)
    .join('');

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ee; padding:32px 16px; font-family:Verdana, Geneva, sans-serif;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background:#ffffff; border-radius:24px; overflow:hidden; box-shadow:0 14px 34px rgba(74,63,58,0.08);">

          <tr>
            <td style="background:#4A3F3A; padding:28px 32px; text-align:center;">
              <div style="font-size:22px; font-weight:bold; color:#f7f3ee; letter-spacing:0.5px;">🧶 Z&amp;Z Crochet</div>
              <div style="font-size:12px; color:#F6D87E; letter-spacing:2px; text-transform:uppercase; margin-top:6px;">Order Received</div>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 8px;">
              <p style="margin:0 0 4px; font-size:18px; color:#4A3F3A; font-weight:bold;">Hi ${order.name},</p>
              <p style="margin:0; font-size:14.5px; line-height:1.6; color:#8a7d76;">
                Thank you for your order! Your request has landed safely in my hook-and-yarn inbox 🐾, here's a quick summary of what you asked for.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8ECDC; border-radius:16px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="font-size:13px; color:#8a7d76; padding:6px 0;">Order ID</td><td style="font-size:13.5px; color:#4A3F3A; font-weight:bold; text-align:right;">${order.id}</td></tr>
                      <tr><td style="font-size:13px; color:#8a7d76; padding:6px 0; border-top:1px solid rgba(74,63,58,0.10);">Item</td><td style="font-size:13.5px; color:#4A3F3A; font-weight:bold; text-align:right; border-top:1px solid rgba(74,63,58,0.10);">${order.itemType}</td></tr>
                      <tr><td style="font-size:13px; color:#8a7d76; padding:6px 0; border-top:1px solid rgba(74,63,58,0.10);">Size</td><td style="font-size:13.5px; color:#4A3F3A; font-weight:bold; text-align:right; border-top:1px solid rgba(74,63,58,0.10);">${order.size}</td></tr>
                      <tr><td style="font-size:13px; color:#8a7d76; padding:6px 0; border-top:1px solid rgba(74,63,58,0.10);">Yarn</td><td style="font-size:13.5px; color:#4A3F3A; font-weight:bold; text-align:right; border-top:1px solid rgba(74,63,58,0.10);">${order.yarnType}</td></tr>
                      <tr><td style="font-size:13px; color:#8a7d76; padding:6px 0; border-top:1px solid rgba(74,63,58,0.10);">Quantity</td><td style="font-size:13.5px; color:#4A3F3A; font-weight:bold; text-align:right; border-top:1px solid rgba(74,63,58,0.10);">${order.qty}</td></tr>
                      <tr><td style="font-size:13px; color:#8a7d76; padding:6px 0; border-top:1px solid rgba(74,63,58,0.10);">Needed by</td><td style="font-size:13.5px; color:#4A3F3A; font-weight:bold; text-align:right; border-top:1px solid rgba(74,63,58,0.10);">${order.deadline || 'No rush'}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${colorChips ? `
          <tr>
            <td style="padding:20px 32px 0;">
              <p style="margin:0 0 10px; font-size:12px; letter-spacing:1px; text-transform:uppercase; color:#8a7d76;">Your chosen palette</p>
              <div>${colorChips}</div>
            </td>
          </tr>` : ''}

          ${order.notes ? `
          <tr>
            <td style="padding:20px 32px 0;">
              <p style="margin:0 0 6px; font-size:12px; letter-spacing:1px; text-transform:uppercase; color:#8a7d76;">Your notes</p>
              <p style="margin:0; font-size:13.5px; line-height:1.6; color:#4A3F3A; font-style:italic;">"${order.notes}"</p>
            </td>
          </tr>` : ''}

          <tr>
            <td style="padding:28px 32px 0;">
              <p style="margin:0 0 10px; font-size:14px; color:#4A3F3A; font-weight:bold;">What happens next?</p>
              <p style="margin:0; font-size:13.5px; line-height:1.7; color:#8a7d76;">
                I'll review your request and reply within <strong style="color:#4A3F3A;">1–2 days</strong> with a quote and estimated completion time. No payment is needed yet, just sit tight!
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 32px 8px; text-align:center;">
              <a href="mailto:${process.env.ADMIN_EMAIL}" style="display:inline-block; background:#E8967E; color:#ffffff; text-decoration:none; font-size:14px; font-weight:bold; padding:13px 28px; border-radius:999px;">
                Questions? Email me
              </a>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 32px 32px; text-align:center; border-top:1px solid rgba(74,63,58,0.10);">
              <p style="margin:18px 0 4px; font-size:13px; color:#4A3F3A; font-weight:bold;">Z&amp;Z Crochet</p>
              <p style="margin:0; font-size:12px; color:#8a7d76; line-height:1.6;">
                Hand-stitched with love in Lahore.<br>
                Every piece made to order — please allow 2–3 weeks.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>`;
}

function adminEmailHtml(order) {
  return `
  <div style="font-family:sans-serif;max-width:520px;">
    <h2>New order: ${order.itemType} (${order.id})</h2>
    <p><strong>From:</strong> ${order.name} &lt;${order.email}&gt;</p>
    <p><strong>Size:</strong> ${order.size} &nbsp; <strong>Yarn:</strong> ${order.yarnType} &nbsp; <strong>Qty:</strong> ${order.qty}</p>
    <p><strong>Colors:</strong> ${order.paletteHex || '—'}</p>
    <p><strong>Deadline:</strong> ${order.deadline || 'No rush'}</p>
    <p><strong>Notes:</strong> ${order.notes || '—'}</p>
    <p><strong>Reference images:</strong> ${order.images.length ? order.images.length + ' attached' : 'none'}</p>
    <p>Manage this order in the admin dashboard.</p>
  </div>`;
}

// ---------- routes ----------
// app.post('/api/orders', upload.array('referenceImages', 6), async (req, res) => {
//   try {
//     const body = req.body;
//     const required = ['itemType', 'size', 'yarnType', 'qty', 'name', 'email'];
//     for (const field of required) {
//       if (!body[field]) return res.status(400).json({ error: `Missing field: ${field}` });
//     }

//     const order = {
//       id: nanoid(10),
//       createdAt: new Date().toISOString(),
//       status: 'new',
//       itemType: body.itemType,
//       size: body.size,
//       yarnType: body.yarnType,
//       qty: body.qty,
//       deadline: body.deadline || '',
//       name: body.name,
//       email: body.email,
//       notes: body.notes || '',
//       paletteHex: body.paletteHex || '',
//       images: (req.files || []).map(f => `/uploads/${f.filename}`)
//     };

//     const orders = readOrders();
//     orders.unshift(order);
//     writeOrders(orders);

//     // Email the customer (their real confirmation)
//     await transporter.sendMail({
//       from: process.env.FROM_EMAIL,
//       to: order.email,
//       subject: `Z&Z Crochet — order received (${order.id})`,
//       html: customerEmailHtml(order)
//     });

//     // Email the admin/shop owner
//     await transporter.sendMail({
//       from: process.env.FROM_EMAIL,
//       to: process.env.ADMIN_EMAIL,
//       subject: `🐾 New order received — ${order.itemType} from ${order.name}`,
//       html: adminEmailHtml(order),
//       attachments: order.images.map(p => ({ path: path.join(__dirname, p) }))
//     });

//     res.json({ success: true, orderId: order.id });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Something went wrong submitting your order. Please try again.' });
//   }
  // });
app.post('/api/orders', upload.array('referenceImages', 6), async (req, res) => {
  try {
    const body = req.body;

    const required = [
      'itemType',
      'size',
      'yarnType',
      'qty',
      'name',
      'email'
    ];

    for (const field of required) {
      if (!body[field]) {
        return res.status(400).json({
          error: `Missing field: ${field}`
        });
      }
    }

    const order = {
      id: nanoid(10),
      createdAt: new Date().toISOString(),
      status: 'new',
      itemType: body.itemType,
      size: body.size,
      yarnType: body.yarnType,
      qty: body.qty,
      deadline: body.deadline || '',
      name: body.name,
      email: body.email,
      notes: body.notes || '',
      paletteHex: body.paletteHex || '',
      images: (req.files || []).map(f => `/uploads/${f.filename}`)
    };

    const orders = readOrders();
    orders.unshift(order);
    writeOrders(orders);

    // Respond immediately
    res.json({
      success: true,
      orderId: order.id
    });

    // Send emails in background
    (async () => {
      try {

        await transporter.sendMail({
          from: process.env.FROM_EMAIL,
          to: order.email,
          subject: `Z&Z Crochet — order received (${order.id})`,
          html: customerEmailHtml(order)
        });

        await transporter.sendMail({
          from: process.env.FROM_EMAIL,
          to: process.env.ADMIN_EMAIL,
          subject: `🐾 New order received — ${order.itemType}`,
          html: adminEmailHtml(order),
          attachments: order.images.map(p => ({
            path: path.join(__dirname, p)
          }))
        });

        console.log("Emails sent.");

      } catch (err) {
        console.error("Email failed:", err);
      }
    })();

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Something went wrong submitting your order.'
    });
  }
});
   

// Admin: list all orders
app.get('/api/orders', requireAdmin, (req, res) => {
  res.json(readOrders());
});

// Admin: update order status (new / in-progress / completed)
app.patch('/api/orders/:id', requireAdmin, (req, res) => {
  const orders = readOrders();
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (req.body.status) order.status = req.body.status;
  writeOrders(orders);
  res.json(order);
});

// Admin: delete an order
app.delete('/api/orders/:id', requireAdmin, (req, res) => {
  let orders = readOrders();
  orders = orders.filter(o => o.id !== req.params.id);
  writeOrders(orders);
  res.json({ success: true });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Z&Z Crochet server running on port ${PORT}`));
