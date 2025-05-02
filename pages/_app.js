import "../styles/globals.css";
import { AuthProvider } from '../contexts/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Toaster } from 'react-hot-toast';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';

// Create a basic Layout component
function Layout({ children }) {
  const router = useRouter();
  
  return (
    <div className="app-container">
      {children}
    </div>
  );
}

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Layout>
        <Component {...pageProps} />
      </Layout>
      <ToastContainer position="bottom-right" />
      <Toaster position="bottom-right" />
    </AuthProvider>
  );
}
