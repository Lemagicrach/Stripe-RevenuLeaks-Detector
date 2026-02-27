// lib/email.ts
import sgMail from '@sendgrid/mail'

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'alerts@revpilot.io'
const FROM_NAME = 'Revpilot Alerts'

interface PriceDropEmailData {
  to: string
  userName: string
  productName: string
  oldPrice: number
  newPrice: number
  productUrl: string
  productImage?: string
}

interface WelcomeEmailData {
  to: string
  userName: string
}

interface WeeklyDigestEmailData {
  to: string
  userName: string
  totalSavings: number
  priceDrops: Array<{
    name: string
    oldPrice: number
    newPrice: number
    url: string
  }>
}

/**
 * Send price drop alert email
 */
export async function sendPriceDropEmail(data: PriceDropEmailData): Promise<void> {
  const savings = data.oldPrice - data.newPrice
  const percentOff = Math.round((savings / data.oldPrice) * 100)

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Price Drop Alert!</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f7f7f7; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 28px; }
    .emoji { font-size: 48px; margin-bottom: 10px; }
    .content { padding: 40px 30px; }
    .product-card { border: 2px solid #e0e0e0; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .product-image { text-align: center; margin-bottom: 20px; }
    .product-image img { max-width: 200px; height: auto; border-radius: 8px; }
    .product-name { font-size: 20px; font-weight: bold; margin-bottom: 15px; color: #333; }
    .price-section { background-color: #f0f9ff; padding: 20px; border-radius: 8px; text-align: center; }
    .old-price { text-decoration: line-through; color: #999; font-size: 18px; }
    .new-price { color: #10b981; font-size: 32px; font-weight: bold; margin: 10px 0; }
    .savings { background-color: #10b981; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; display: inline-block; margin-top: 10px; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
    .cta-button:hover { opacity: 0.9; }
    .footer { background-color: #f7f7f7; padding: 30px; text-align: center; color: #666; font-size: 14px; }
    .unsubscribe { color: #999; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="emoji">💰</div>
      <h1>Price Drop Alert!</h1>
      <p style="color: #fff; margin: 10px 0 0 0;">The product you're tracking just got cheaper</p>
    </div>
    
    <div class="content">
      <p>Hi ${data.userName},</p>
      <p>Great news! The price has dropped on a product you're tracking:</p>
      
      <div class="product-card">
        ${data.productImage ? `
        <div class="product-image">
          <img src="${data.productImage}" alt="${data.productName}" />
        </div>
        ` : ''}
        
        <div class="product-name">${data.productName}</div>
        
        <div class="price-section">
          <div class="old-price">Was $${data.oldPrice.toFixed(2)}</div>
          <div class="new-price">Now $${data.newPrice.toFixed(2)}</div>
          <div class="savings">Save $${savings.toFixed(2)} (${percentOff}% OFF)</div>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
          <a href="${data.productUrl}" class="cta-button">🛒 Buy Now</a>
        </div>
      </div>
      
      <p>This is a great opportunity to buy at a lower price. Prices can change quickly, so act fast!</p>
      
      <p style="margin-top: 30px;">
        <strong>💡 Pro Tip:</strong> Price drops often happen in cycles. If you miss this one, you can keep tracking for the next drop!
      </p>
    </div>
    
    <div class="footer">
      <p>You're receiving this because you're tracking this product on PriceDrop.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/settings" class="unsubscribe">Manage email preferences</a></p>
      <p style="margin-top: 20px; color: #999; font-size: 12px;">
        © ${new Date().getFullYear()} PriceDrop. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `

  const text = `
Price Drop Alert!

Hi ${data.userName},

Great news! ${data.productName} has dropped in price:

Was: $${data.oldPrice.toFixed(2)}
Now: $${data.newPrice.toFixed(2)}
Save: $${savings.toFixed(2)} (${percentOff}% OFF)

Buy now: ${data.productUrl}

This is a great opportunity to buy at a lower price. Prices can change quickly, so act fast!

---
Manage your settings: ${process.env.NEXT_PUBLIC_APP_URL}/settings
  `

  try {
    await sgMail.send({
      to: data.to,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
      subject: `🎉 Price Drop Alert: ${data.productName} is now $${data.newPrice}!`,
      text,
      html
    })

    console.log(`✅ Price drop email sent to ${data.to}`)
  } catch (error: any) {
    console.error('❌ Failed to send price drop email:', error.response?.body || error.message)
    throw error
  }
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f7f7f7; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white; }
    .content { padding: 40px 30px; }
    .step { margin: 30px 0; padding: 20px; border-left: 4px solid #667eea; background-color: #f7f9fc; }
    .cta-button { display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; }
    .footer { background-color: #f7f7f7; padding: 30px; text-align: center; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to PriceDrop! 💰</h1>
      <p>Never overpay for products again</p>
    </div>
    
    <div class="content">
      <p>Hi ${data.userName},</p>
      <p>Welcome to PriceDrop! We're excited to help you save money on your online purchases.</p>
      
      <h2>Get Started in 3 Easy Steps:</h2>
      
      <div class="step">
        <strong>1. Add Your First Product</strong><br>
        Copy any product URL from eBay, Amazon, or Walmart and paste it into PriceDrop.
      </div>
      
      <div class="step">
        <strong>2. Set Your Target Price (Optional)</strong><br>
        Tell us your ideal price, and we'll alert you when it drops to that amount.
      </div>
      
      <div class="step">
        <strong>3. Sit Back and Save</strong><br>
        We'll monitor prices 24/7 and notify you instantly when there's a drop.
      </div>
      
      <div style="text-align: center; margin: 40px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" class="cta-button">Start Tracking Products</a>
      </div>
      
      <p><strong>💡 Pro Tips:</strong></p>
      <ul>
        <li>Track products you're planning to buy in the next few months</li>
        <li>Set price alerts for your dream items</li>
        <li>Check your dashboard regularly to see price trends</li>
      </ul>
      
      <p>If you have any questions, just reply to this email. We're here to help!</p>
      
      <p>Happy saving!<br>The PriceDrop Team</p>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} PriceDrop. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `

  try {
    await sgMail.send({
      to: data.to,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
      subject: '👋 Welcome to PriceDrop - Start Saving Today!',
      html
    })

    console.log(`✅ Welcome email sent to ${data.to}`)
  } catch (error: any) {
    console.error('❌ Failed to send welcome email:', error.response?.body || error.message)
    throw error
  }
}

/**
 * Send weekly digest email
 */
export async function sendWeeklyDigestEmail(data: WeeklyDigestEmailData): Promise<void> {
  const priceDropsList = data.priceDrops.map(drop => `
    <div style="margin: 15px 0; padding: 15px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <strong>${drop.name}</strong><br>
      <span style="text-decoration: line-through; color: #999;">$${drop.oldPrice}</span>
      <span style="color: #10b981; font-size: 20px; font-weight: bold;"> → $${drop.newPrice}</span>
      <br>
      <a href="${drop.url}" style="color: #667eea;">View Product →</a>
    </div>
  `).join('')

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; color: white; }
    .content { padding: 40px 30px; }
    .savings-badge { background-color: #10b981; color: white; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0; }
    .savings-amount { font-size: 36px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your Weekly Savings Report 📊</h1>
    </div>
    
    <div class="content">
      <p>Hi ${data.userName},</p>
      
      <div class="savings-badge">
        <div>You saved this week</div>
        <div class="savings-amount">$${data.totalSavings.toFixed(2)}</div>
      </div>
      
      <h2>Price Drops This Week (${data.priceDrops.length})</h2>
      ${priceDropsList}
      
      <p style="margin-top: 30px;">Keep tracking to maximize your savings!</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="display: inline-block; background: #667eea; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px;">View Dashboard</a>
      </div>
    </div>
  </div>
</body>
</html>
  `

  try {
    await sgMail.send({
      to: data.to,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
      subject: `📊 Your Weekly Report: $${data.totalSavings.toFixed(2)} in Savings!`,
      html
    })

    console.log(`✅ Weekly digest sent to ${data.to}`)
  } catch (error: any) {
    console.error('❌ Failed to send weekly digest:', error)
    throw error
  }
}

/**
 * Fallback to console if SendGrid not configured
 */
function logEmailToConsole(type: string, data: any) {
  console.log(`📧 [${type}] Email would be sent:`, data)
}

// Export a testing function
export async function testEmail() {
  await sendPriceDropEmail({
    to: 'test@example.com',
    userName: 'Test User',
    productName: 'Amazing Wireless Headphones',
    oldPrice: 149.99,
    newPrice: 99.99,
    productUrl: 'https://example.com/product',
    productImage: 'https://via.placeholder.com/200'
  })
}