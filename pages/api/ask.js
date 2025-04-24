// pages/api/ask.js
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  const { query, data } = req.body;

  // Convert data to tab-separated string for better formatting
  const formattedData = data.map(row => row.join('\t')).join('\n');

  try {
    const prompt = `
Here is a spreadsheet table (tab-separated):

${formattedData}

User's question: ${query}

Analyze the spreadsheet data and give a clear, helpful answer based on the data. 
If the question requires calculations, show your work.
If the answer involves identifying trends or patterns, explain them.
If the data is incomplete or doesn't contain information to answer the question, say so.
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // or your preferred model
      messages: [{ role: 'user', content: prompt }],
    });

    res.status(200).json({ answer: completion.choices[0].message.content });
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    res.status(500).json({ 
      error: 'Failed to process your request',
      details: error.message 
    });
  }
}