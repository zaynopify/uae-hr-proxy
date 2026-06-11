const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'UAE HR Proxy is running' });
});
// Test Notion connection
app.get('/test-notion', async (req, res) => {
  const token = req.query.token;
  if (!token) return res.json({ error: 'No token provided' });
  
  try {
    const result = await queryNotion('737f57cda9be466997574d1aa1bc7554', token, null);
    res.json({ 
      success: true, 
      records: result ? result.length : 0,
      sample: result?.[0]?.properties ? Object.keys(result[0].properties) : []
    });
  } catch(e) {
    res.json({ error: e.message });
  }
});
// Main chat endpoint
app.post('/chat', async (req, res) => {
  const { message, notionToken, empDbId, leaveDbId, compDbId, payDbId, history } = req.body;

  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    // Fetch Notion data
    let notionContext = '';

    if (notionToken) {
      const msg = message.toLowerCase();

      // Employee data
      if (msg.includes('employee') || msg.includes('staff') || msg.includes('how many') || msg.includes('who')) {
        const dbId = empDbId || '116078c2-4941-4ea3-ade0-47d98d094528';
      const data = await queryNotion(dbId, notionToken, {
  property: 'Status',
  select: { equals: 'Active' }
});
        if (data && data.length > 0) {
          notionContext += `\n\n👥 LIVE EMPLOYEE DATA (${data.length} active employees):\n`;
          data.slice(0, 20).forEach(r => {
            const p = r.properties;
            const name = getText(p['Full Name'] || p['Employee Name'] || p['Name'] || p[Object.keys(p)[0]]);
            const position = getText(p['Designation'] || p['Position'] || p['Job Title']);
            const dept = getText(p['Department']);
            const status = getText(p['Status']);
            if (name) notionContext += `- ${name}${position ? ' | ' + position : ''}${dept ? ' | ' + dept : ''}${status ? ' | ' + status : ''}\n`;
          });
        }
      }

      // Leave requests
      if (msg.includes('leave') || msg.includes('pending') || msg.includes('request') || msg.includes('balance')) {
        const dbId = leaveDbId || '0c37701c-2c94-41fd-a5cd-616759676287';
        const data = await queryNotion(dbId, notionToken, {
          property: 'Approval Status',
          select: { equals: 'Pending' }
        });
        if (data && data.length > 0) {
          notionContext += `\n\n🏖️ PENDING LEAVE REQUESTS (${data.length}):\n`;
          data.forEach(r => {
            const p = r.properties;
            const name = getText(p['Leave Request'] || p['Name'] || p[Object.keys(p)[0]]);
            const type = getText(p['Leave Type']);
            const start = getText(p['Start Date']);
            const end = getText(p['End Date']);
            notionContext += `- ${name}: ${type} | ${start} to ${end} | PENDING\n`;
          });
        } else if (data) {
          notionContext += '\n\n🏖️ LEAVE: No pending leave requests.';
        }
      }

      // Compliance
      if (msg.includes('compliance') || msg.includes('expir') || msg.includes('visa') || msg.includes('critical')) {
        const dbId = empDbId || '737f57cda9be466997574d1aa1bc7554';
        const data = await queryNotion(dbId, notionToken, {
          or: [
            { property: 'Status', select: { equals: 'Critical' } },
            { property: 'Status', select: { equals: 'Expired' } }
          ]
        });
        if (data && data.length > 0) {
          notionContext += `\n\n⚠️ COMPLIANCE ALERTS (${data.length} critical/expired):\n`;
          data.forEach(r => {
            const p = r.properties;
            const name = getText(p['Employee Name'] || p['Name'] || p[Object.keys(p)[0]]);
            const doc = getText(p['Document Type'] || p['Type']);
            const status = getText(p['Status']);
            const expiry = getText(p['Expiry Date'] || p['Expiry']);
            const days = getText(p['Days Remaining'] || p['Days']);
            notionContext += `- ${name}: ${doc} | ${status} | Expires: ${expiry} | Days: ${days}\n`;
          });
        } else if (data) {
          notionContext += '\n\n✅ COMPLIANCE: No critical or expired items.';
        }
      }

      // Payroll
      if (msg.includes('payroll') || msg.includes('salary') || msg.includes('wps')) {
        const dbId = payDbId || '9e05c8c3-a1d1-400e-975c-07e36e6980b6';
        const data = await queryNotion(dbId, notionToken, null);
        if (data && data.length > 0) {
          notionContext += `\n\n💰 PAYROLL DATA (${data.length} records):\n`;
          data.slice(0, 10).forEach(r => {
            const p = r.properties;
            const name = getText(p['Employee Name'] || p['Name'] || p[Object.keys(p)[0]]);
            const basic = getText(p['Basic Salary AED'] || p['Basic Salary'] || p['Basic']);
            const net = getText(p['Net Salary'] || p['Net']);
            const wps = getText(p['WPS Status'] || p['Status']);
            if (name) notionContext += `- ${name}: Basic AED ${basic} | Net AED ${net} | WPS: ${wps}\n`;
          });
        }
      }
    }

    // Build messages
    const messages = (history || []).map(m => ({
      role: m.role,
      content: m.content
    }));

    // Add current message with Notion context
    messages.push({
      role: 'user',
      content: notionContext ? `${message}\n\n[LIVE NOTION WORKSPACE DATA]:${notionContext}` : message
    });

    // Call Groq API
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return res.status(500).json({ error: 'Groq API key not configured on server' });

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!groqRes.ok) {
      const err = await groqRes.json().catch(() => ({}));
      return res.status(500).json({ error: err.error?.message || 'Groq API error' });
    }

    const groqData = await groqRes.json();
    const reply = groqData.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';

    res.json({ reply, notionDataFetched: notionContext.length > 0 });

  } catch (e) {
    console.error('Proxy error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Query Notion database
async function queryNotion(dbId, token, filter) {
  try {
    const body = { page_size: 50 };
    if (filter) body.filter = filter;

    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.results || [];
  } catch (e) {
    return null;
  }
}

// Extract text from Notion property
function getText(prop) {
  if (!prop) return '';
  if (prop.type === 'title') return prop.title?.map(t => t.plain_text).join('') || '';
  if (prop.type === 'rich_text') return prop.rich_text?.map(t => t.plain_text).join('') || '';
  if (prop.type === 'select') return prop.select?.name || '';
  if (prop.type === 'number') return prop.number?.toString() || '';
  if (prop.type === 'date') return prop.date?.start || '';
  if (prop.type === 'formula') {
    const f = prop.formula;
    if (f?.type === 'number') return f.number?.toString() || '';
    if (f?.type === 'string') return f.string || '';
  }
  return '';
}

const SYSTEM_PROMPT = `You are an expert UAE HR Assistant with 15 years of experience in UAE human resources and employment law. You work inside a company's Notion-based HR Operating System.

CRITICAL: When the user's message contains [LIVE NOTION WORKSPACE DATA], you MUST use that data to answer. It is real live data from the company's Notion databases. Always reference specific names and numbers from that data.

YOUR EXPERTISE:
- Federal Decree-Law No. 33 of 2021 (UAE Labour Law)
- Annual Leave: 30 calendar days (Art. 29)
- Sick Leave: 90 days — 15 full, 30 half, 45 unpaid (Art. 31)
- Maternity: 60 days — 45 full, 15 half (Art. 30)
- Paternity: 5 working days (Art. 32)
- Probation: max 6 months (Art. 9)
- Notice Period: 30-90 days (Art. 43)
- Gratuity: 21 days/year first 5 years, 30 days/year after (Art. 51)
- Summary Dismissal grounds (Art. 44)
- WPS regulations and SIF file requirements
- Emiratisation Nafis targets

RESPONSE STYLE:
- Direct and specific
- Always cite UAE law articles
- Use AED for money, DD/MM/YYYY for dates
- Reference actual employee names when Notion data is available
- Flag urgent issues with ⚠️
- NEVER say you cannot access Notion — the data is already in the message`;

app.listen(PORT, () => {
  console.log(`UAE HR Proxy running on port ${PORT}`);
});
