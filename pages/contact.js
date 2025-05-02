import React, { useState } from 'react';
import Head from 'next/head';
import styles from '../styles/Contact.module.css';

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setStatus('loading');
    setError('');
    // Simulate API call
    setTimeout(() => {
      if (form.name && form.email && form.message) {
        setStatus('success');
        setForm({ name: '', email: '', message: '' });
      } else {
        setStatus('error');
        setError('Please fill in all fields.');
      }
    }, 1200);
  };

  return (
    <div className={styles.contactPage}>
      <Head>
        <title>Contact Us | UnifiedData</title>
        <meta name="description" content="Contact UnifiedData for support, or general inquiries." />
      </Head>
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Contact Us</h1>
          <p className={styles.subtitle}>We'd love to hear from you! Fill out the form and our team will get back to you soon.</p>
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="name" className={styles.formLabel}>Name</label>
              <input type="text" id="name" name="name" value={form.name} onChange={handleChange} required className={styles.formInput} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.formLabel}>Email</label>
              <input type="email" id="email" name="email" value={form.email} onChange={handleChange} required className={styles.formInput} />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="message" className={styles.formLabel}>Message</label>
              <textarea id="message" name="message" rows={5} value={form.message} onChange={handleChange} required className={styles.formInput} />
            </div>
            <button className={styles.submitButton} type="submit" disabled={status === 'loading'}>
              {status === 'loading' ? 'Sending...' : 'Send Message'}
            </button>
            {status === 'success' && <div className={styles.success}>Thank you! We have received your message.</div>}
            {status === 'error' && <div className={styles.error}>{error}</div>}
          </form>
        </div>
        <div className={styles.info}>
          <h2>Contact Information</h2>
          <p>Email: <a href="mailto:ishan.pathak@unifieddata.app">ishan.pathak@unifieddata.app</a></p>
          
          <div className={styles.socials}>
            <a href="#" aria-label="Twitter">🐦</a>
            <a href="#" aria-label="LinkedIn">💼</a>
            <a href="#" aria-label="GitHub">💻</a>
          </div>
        </div>
      </div>
    </div>
  );
} 