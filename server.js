const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'UAE HR OS Proxy is running', version: '2.1', databases: 12 });
});

// ─── Database IDs ─────────────────────────────────────────────────
const DB = {
  employees:      '737f57cda9be466997574d1aa1bc7554',
  leave:          '0c37701c-2c94-41fd-a5cd-616759676287',
  leaveBalance:   '374baa4e-5fb7-80c8-a75f-000b264bf244',
  compliance:     '73f1c3bcb9774ad99fc2461255fdde48',
  payroll:        '9e05c8c3-a1d1-400e-975c-07e36e6980b6',
  onboarding:     'f238abda-f27a-4ac3-aaa6-feea7d0348b7',
  offboarding:    '06572eaa-0d1f-438d-8585-2074ef9db228',
  recruitment:    '116078c2-4941-4ea3-ade0-47d98d094529',
  performance:    '116078c2-4941-4ea3-ade0-47d98d094530',
  knowledge:      'ae7e1df9-b673-4238-8848-7d17a30f8511',
  policies:       '375baa4e-5fb7-808e-993d-fbfe58239400',
  templates:      '375baa4e-5fb7-80e8-90ba-fa64ef79b511'
};

// ─── Main Chat Endpoint ───────────────────────────────────────────
app.post('/chat', async (req, res) => {
  const { message, notionToken, empDbId, leaveDbId, compDbId, payDbId, history } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  try {
    const msg = message.toLowerCase();
    let notionContext = '';
    const token = notionToken || '';

    if (token) {
      // ── 1. EMPLOYEES ──────────────────────────────────────────
      if (msg.includes('employee') || msg.includes('staff') || msg.includes('team') ||
          msg.includes('who') || msg.includes('how many') || msg.includes('salary') ||
          msg.includes('email') || msg.includes('phone') || msg.includes('visa') ||
          msg.includes('passport') || msg.includes('emirates') || msg.includes('labour') ||
          msg.includes('insurance') || msg.includes('probation') || msg.includes('contract') ||
          msg.includes('nationality') || msg.includes('department') || msg.includes('designation') ||
          msg.includes('joining') || msg.includes('asset') || msg.includes('payroll status') ||
          msg.includes('dob') || msg.includes('birth') || msg.includes('manager')) {

        const dbId = empDbId || DB.employees;
        const data = await queryNotion(dbId, token, null);
        if (data && data.length > 0) {
          notionContext += `\n\n👥 EMPLOYEE DATABASE (${data.length} total):\n`;
          data.forEach(r => {
            const p = r.properties;
            const name = getText(p['Full Name']);
            if (!name) return;
            notionContext += `
EMPLOYEE: ${name}
- ID: ${getText(p['Employee ID'])} | Status: ${getText(p['Status'])} | Type: ${getText(p['Employee Type'])}
- Position: ${getText(p['Designation'])} | Department: ${getText(p['Department'])} | Manager: ${getText(p['Manager'])}
- Nationality: ${getText(p['Nationality'])} | Visa: ${getText(p['Visa Type'])} | Location: ${getText(p['Work Location'])}
- Work Email: ${getText(p['Work Email'])} | Phone: ${getText(p['Phone'])}
- Basic Salary: AED ${getText(p['Basic Salary'])} | Housing: AED ${getText(p['Housing Allowance'])} | Transport: AED ${getText(p['Transport Allowance'])} | Other: AED ${getText(p['Other Allowance'])} | Total: AED ${getText(p['Salary'])}
- Join Date: ${getText(p['Joining/Contract Start Date'])} | Contract: ${getText(p['Contract Duration'])} | Contract End: ${getText(p['Contract End Date'])}
- Probation: ${getText(p['Probation Period'])} | Probation Status: ${getText(p['Probation Status'])} | Probation End: ${getText(p['Probation End Date'])}
- Emirates ID: ${getText(p['Emirates ID No.'])} | Emirates ID Expiry: ${getText(p['Emirates ID Expiry'])}
- Passport Expiry: ${getText(p['Passport Expiry'])} | Labour Card Expiry: ${getText(p['Labour Card Expiry'])} | Insurance Expiry: ${getText(p['Insurance Expiry'])}
- Payroll Status: ${getText(p['Payroll Status'])} | Leave Balance: ${getText(p['Leave Balance (Days)'])} days
- Assets: ${getText(p['Assets Assigned'])} | DOB: ${getText(p['Date of Birth'])}
`;
          });
        }
      }

      // ── 2. LEAVE REQUESTS ─────────────────────────────────────
      if (msg.includes('leave') || msg.includes('annual') || msg.includes('sick') ||
          msg.includes('maternity') || msg.includes('paternity') || msg.includes('hajj') ||
          msg.includes('emergency') || msg.includes('pending') || msg.includes('approved') ||
          msg.includes('rejected') || msg.includes('request')) {

        const dbId = leaveDbId || DB.leave;
        const data = await queryNotion(dbId, token, null);
        if (data && data.length > 0) {
          notionContext += `\n\n🏖️ LEAVE REQUESTS (${data.length} total):\n`;
          data.forEach(r => {
            const p = r.properties;
            const name = getText(p['Leave Request'] || p['Name'] || p[Object.keys(p)[0]]);
            notionContext += `- ${name}: ${getText(p['Leave Type'])} | ${getText(p['Start Date'])} to ${getText(p['End Date'])} | Days: ${getText(p['Total Days'])} | Status: ${getText(p['Approval Status'])}\n`;
          });
        }
      }

      // ── 3. LEAVE BALANCE ──────────────────────────────────────
      if (msg.includes('balance') || msg.includes('remaining') || msg.includes('entitlement') ||
          msg.includes('how many leave') || msg.includes('days left')) {

        const data = await queryNotion(DB.leaveBalance, token, null);
        if (data && data.length > 0) {
          notionContext += `\n\n📊 LEAVE BALANCES (${data.length} records):\n`;
          data.forEach(r => {
            const p = r.properties;
            const name = getText(p['Name'] || p[Object.keys(p)[0]]);
            notionContext += `- ${name}: Type: ${getText(p['Leave Type'])} | Entitlement: ${getText(p['Leave Entitlement'])} days | Used: ${getText(p['Used Days'])} days | Remaining: ${getText(p['Remaining Balance'])} days | Status: ${getText(p['Balance Status'])}\n`;
          });
        }
      }

      // ── 4. COMPLIANCE ─────────────────────────────────────────
      if (msg.includes('compliance') || msg.includes('expir') || msg.includes('visa') ||
          msg.includes('critical') || msg.includes('expired') || msg.includes('passport') ||
          msg.includes('emirates id') || msg.includes('labour card') || msg.includes('health insurance') ||
          msg.includes('work permit') || msg.includes('document')) {

        const dbId = compDbId || DB.compliance;
        const data = await queryNotion(dbId, token, null);
        if (data && data.length > 0) {
          notionContext += `\n\n✅ COMPLIANCE TRACKER (${data.length} records):\n`;
          data.forEach(r => {
            const p = r.properties;
            const name = getText(p['Employee Name'] || p['Name'] || p[Object.keys(p)[0]]);
            notionContext += `- ${name}: ${getText(p['Document Type'])} | Expiry: ${getText(p['Expiry Date'])} | Days Remaining: ${getText(p['Days Remaining'])} | Status: ${getText(p['Status'])}\n`;
          });
        }
      }

      // ── 5. PAYROLL ────────────────────────────────────────────
      if (msg.includes('payroll') || msg.includes('wps') || msg.includes('net salary') ||
          msg.includes('gross') || msg.includes('payment') || msg.includes('pay slip') ||
          msg.includes('last month') || msg.includes('this month') || msg.includes('overtime') ||
          msg.includes('bonus') || msg.includes('deduction')) {

        const dbId = payDbId || DB.payroll;
        const data = await queryNotion(dbId, token, null);
        if (data && data.length > 0) {
          notionContext += `\n\n💰 PAYROLL RECORDS (${data.length} records):\n`;
          data.forEach(r => {
            const p = r.properties;
            const name = getText(p['Record Title'] || p[Object.keys(p)[0]]);
            notionContext += `- ${name}: Period: ${getText(p['Pay Period'])} | Basic: AED ${getText(p['Basic Salary AED'])} | Housing: AED ${getText(p['Housing Allowance AED'])} | Transport: AED ${getText(p['Transport Allowance AED'])} | Gross: AED ${getText(p['Gross Salary AED'])} | Net: AED ${getText(p['Net Salary AED'])} | WPS: ${getText(p['WPS Status'])}\n`;
          });
        }
      }

      // ── 6. ONBOARDING ─────────────────────────────────────────
      if (msg.includes('onboard') || msg.includes('new join') || msg.includes('joining process') ||
          msg.includes('visa process') || msg.includes('orientation') || msg.includes('induction')) {

        const data = await queryNotion(DB.onboarding, token, null);
        if (data && data.length > 0) {
          notionContext += `\n\n🚀 ONBOARDING (${data.length} records):\n`;
          data.forEach(r => {
            const p = r.properties;
            const name = getText(p['Employee Name'] || p['Name'] || p[Object.keys(p)[0]]);
            notionContext += `- ${name}: Start: ${getText(p['Start Date'])} | Visa Stage: ${getText(p['Visa Process Started'])} | Status: ${getText(p['Onboarding Status'])} | Probation: ${getText(p['Probation Period'])}\n`;
          });
        }
      }

      // ── 7. OFFBOARDING ────────────────────────────────────────
      if (msg.includes('offboard') || msg.includes('resign') || msg.includes('terminat') ||
          msg.includes('last working') || msg.includes('eos') || msg.includes('gratuity') ||
          msg.includes('clearance') || msg.includes('exit')) {

        const data = await queryNotion(DB.offboarding, token, null);
        if (data && data.length > 0) {
          notionContext += `\n\n👋 OFFBOARDING (${data.length} records):\n`;
          data.forEach(r => {
            const p = r.properties;
            const name = getText(p['Offboarding Title'] || p['Name'] || p[Object.keys(p)[0]]);
            notionContext += `- ${name}: Reason: ${getText(p['Reason For Leaving'])} | Last Day: ${getText(p['Last Working Day'])} | Notice: ${getText(p['Notice Period'])} | EOS Gratuity: AED ${getText(p['EOS Gratuity AED'])} | Status: ${getText(p['Status'])}\n`;
          });
        }
      }

      // ── 8. RECRUITMENT ────────────────────────────────────────
      if (msg.includes('recruit') || msg.includes('candidate') || msg.includes('interview') ||
          msg.includes('hiring') || msg.includes('vacancy') || msg.includes('applicant') ||
          msg.includes('job') || msg.includes('open position')) {

        const data = await queryNotion(DB.recruitment, token, null);
        if (data && data.length > 0) {
          notionContext += `\n\n🎯 RECRUITMENT (${data.length} candidates):\n`;
          data.forEach(r => {
            const p = r.properties;
            const name = getText(p['Candidate Name'] || p['Name'] || p[Object.keys(p)[0]]);
            notionContext += `- ${name}: Role: ${getText(p['Position Applied'] || p['Role'])} | Stage: ${getText(p['Stage'] || p['Status'])} | Date: ${getText(p['Applied Date'] || p['Interview Date'])}\n`;
          });
        }
      }

      // ── 9. PERFORMANCE ────────────────────────────────────────
      if (msg.includes('performance') || msg.includes('kpi') || msg.includes('rating') ||
          msg.includes('review') || msg.includes('appraisal') || msg.includes('score') ||
          msg.includes('outstanding') || msg.includes('exceeds') || msg.includes('needs improvement')) {

        const data = await queryNotion(DB.performance, token, null);
        if (data && data.length > 0) {
          notionContext += `\n\n📈 PERFORMANCE (${data.length} records):\n`;
          data.forEach(r => {
            const p = r.properties;
            const name = getText(p['Employee'] || p['Name'] || p[Object.keys(p)[0]]);
            notionContext += `- ${name}: KPI Score: ${getText(p['Overall Score'])} | Rating: ${getText(p['Rating'])} | Period: ${getText(p['Review Period'])}\n`;
          });
        }
      }

      // ── 10. HR KNOWLEDGE BASE ─────────────────────────────────
      if (msg.includes('law') || msg.includes('article') || msg.includes('fdl') ||
          msg.includes('mohre') || msg.includes('policy') || msg.includes('procedure') ||
          msg.includes('rule') || msg.includes('regulation') || msg.includes('entitlement') ||
          msg.includes('emiratisation') || msg.includes('nafis')) {

        const data = await queryNotion(DB.knowledge, token, null);
        if (data && data.length > 0) {
          notionContext += `\n\n📚 HR KNOWLEDGE BASE (${data.length} articles):\n`;
          data.forEach(r => {
            const p = r.properties;
            const title = getText(p['Article Title'] || p['Name'] || p[Object.keys(p)[0]]);
            notionContext += `- ${title}: ${getText(p['Law Reference'])} | ${getText(p['Plain English Summary'])}\n`;
          });
        }
      }

      // ── 11. HR POLICY CENTER ──────────────────────────────────
      if (msg.includes('policy') || msg.includes('policies') || msg.includes('remote work') ||
          msg.includes('flexible work') || msg.includes('health and safety') ||
          msg.includes('code of conduct') || msg.includes('data security') ||
          msg.includes('it policy') || msg.includes('compensation policy') ||
          msg.includes('emiratisation policy') || msg.includes('emiratization policy') ||
          msg.includes('acknowledg')) {

        const data = await queryNotion(DB.policies, token, null);
        if (data && data.length > 0) {
          notionContext += `\n\n📜 HR POLICY CENTER (${data.length} policies):\n`;
          data.forEach(r => {
            const p = r.properties;
            const name = getText(p['Policy Name'] || p[Object.keys(p)[0]]);
            notionContext += `- ${name}: Category: ${getText(p['Category'])} | Status: ${getText(p['Status'])} | Version: ${getText(p['Version'])} | Effective: ${getText(p['Effective Date'])} | Last Reviewed: ${getText(p['Last Reviewed Date'])} | Acknowledgment Required: ${getText(p['Acknowledgment Required'])}\n`;
          });
        }
      }

      // ── 12. HR TEMPLATE CENTER ─────────────────────────────────
      if (msg.includes('template') || msg.includes('show cause') || msg.includes('noc') ||
          msg.includes('experience letter') || msg.includes('offer letter') ||
          msg.includes('probation extension') || msg.includes('final warning')) {

        const data = await queryNotion(DB.templates, token, null);
        if (data && data.length > 0) {
          notionContext += `\n\n📝 HR TEMPLATE CENTER (${data.length} templates):\n`;
          data.forEach(r => {
            const p = r.properties;
            const name = getText(p['Template Name'] || p[Object.keys(p)[0]]);
            notionContext += `- ${name}: Type: ${getText(p['Type'])} | Language: ${getText(p['Language'])} | MOHRE Compliant: ${getText(p['MOHRE Complaint'])} | Last Updated: ${getText(p['Last Updated'])}\n`;
          });
        }
      }
    }

    console.log('Notion context length:', notionContext.length);

    // Build message history
    const messages = (history || []).map(m => ({ role: m.role, content: m.content }));
    messages.push({
      role: 'user',
      content: notionContext ? `${message}\n\n[LIVE HR OS DATA]:${notionContext}` : message
    });

    // Call Groq
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return res.status(500).json({ error: 'Groq API key not configured' });

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        max_tokens: 1500,
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

// Test endpoint
app.get('/test-notion', async (req, res) => {
  const token = req.query.token;
  if (!token) return res.json({ error: 'No token provided' });
  try {
    const result = await queryNotion(DB.employees, token, null);
    res.json({ success: true, records: result ? result.length : 0 });
  } catch(e) {
    res.json({ error: e.message });
  }
});

// Query Notion
async function queryNotion(dbId, token, filter) {
  try {
    const body = { page_size: 50 };
    if (filter) body.filter = filter;
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.results || [];
  } catch(e) { return null; }
}

// Extract text from Notion property
function getText(prop) {
  if (!prop) return '';
  if (prop.type === 'title') return prop.title?.map(t => t.plain_text).join('') || '';
  if (prop.type === 'rich_text') return prop.rich_text?.map(t => t.plain_text).join('') || '';
  if (prop.type === 'select') return prop.select?.name || '';
  if (prop.type === 'multi_select') return prop.multi_select?.map(s => s.name).join(', ') || '';
  if (prop.type === 'number') return prop.number?.toString() || '';
  if (prop.type === 'date') return prop.date?.start || '';
  if (prop.type === 'checkbox') return prop.checkbox ? 'Yes' : 'No';
  if (prop.type === 'email') return prop.email || '';
  if (prop.type === 'phone_number') return prop.phone_number || '';
  if (prop.type === 'url') return prop.url || '';
  if (prop.type === 'formula') {
    const f = prop.formula;
    if (f?.type === 'number') return f.number?.toString() || '';
    if (f?.type === 'string') return f.string || '';
    if (f?.type === 'date') return f.date?.start || '';
    if (f?.type === 'boolean') return f.boolean ? 'Yes' : 'No';
  }
  if (prop.type === 'rollup') {
    const r = prop.rollup;
    if (r?.type === 'number') return r.number?.toString() || '';
    if (r?.type === 'array') return r.array?.map(item => getText(item)).join(', ') || '';
  }
  if (prop.type === 'relation') return prop.relation?.length > 0 ? `${prop.relation.length} linked` : '';
  if (prop.type === 'status') return prop.status?.name || '';
  return '';
}

const SYSTEM_PROMPT = `You are an expert UAE HR Manager Assistant with 15 years of UAE HR experience. You have full access to the company's HR Operating System (HR OS) built on Notion.

CRITICAL RULES:
1. When [LIVE HR OS DATA] is provided — ALWAYS use it. Reference specific names, numbers, dates from the data.
2. NEVER make up or hallucinate data. If data is not in the HR OS, say so clearly.
3. Always cite UAE Labour Law articles when relevant (Federal Decree-Law No. 33 of 2021).
4. Use AED for money, DD/MM/YYYY for dates.
5. Be direct, specific and professional.
6. Flag urgent issues (expired documents, critical compliance) with ⚠️.

YOUR UAE HR EXPERTISE:
- Annual Leave: 30 days/year (Art. 29 FDL 33/2021)
- Sick Leave: 90 days — 15 full pay, 30 half pay, 45 unpaid (Art. 31)
- Maternity: 60 days — 45 full, 15 half (Art. 30)
- Paternity: 5 working days (Art. 32)
- Hajj Leave: 30 days unpaid, once in service (Art. 29)
- Probation: max 6 months (Art. 9)
- Notice Period: 30-90 days (Art. 43)
- Gratuity: 21 days/year first 5 years, 30 days/year after 5 years, based on basic salary (Art. 51)
- Summary Dismissal grounds (Art. 44)
- WPS: salary within last working day of month
- Emiratisation: 2% annual increase for companies 50+ employees
- Non-compete: max 2 years (Art. 10)

DATABASES YOU CAN ACCESS:
1. Employee Database — all employee records, salaries, documents
2. Leave Management — all leave requests and approvals
3. Leave Balance Tracker — remaining leave days per employee
4. UAE Compliance Tracker — visa, passport, emirates ID expiries
5. Payroll Tracker — monthly salary records, WPS status
6. Onboarding System — new joiner progress
7. Offboarding System — resignation/termination records, EOS gratuity
8. Recruitment Tracker — candidates and hiring pipeline
9. Performance Management — KPI scores and ratings
10. HR Knowledge Base — UAE labour law articles and SOPs
11. HR Policy Center — company policies (category, status, version, review dates)
12. HR Template Center — available HR document templates (warning, termination, NOC, offer letter, etc.)

Always give specific, actionable answers. If asked about an employee, give their exact details from the data.`;

app.listen(PORT, () => console.log(`UAE HR OS Proxy v2.0 running on port ${PORT}`));
