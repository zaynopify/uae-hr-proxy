const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'UAE HR Proxy is running' });
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
          status: { equals: 'Active' }
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
        const dbId = compDbId || '73f1c3bc-b977-4ad9-9fc2-461255fdde48';
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
