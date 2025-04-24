import "../styles/globals.css";
import SignIn from '../components/auth/SignIn';
import { AuthProvider } from '../contexts/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { Toaster } from 'react-hot-toast';

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
      <ToastContainer position="bottom-right" />
      <Toaster position="bottom-right" />
    </AuthProvider>
  );
}
