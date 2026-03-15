/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  Phone, 
  Instagram, 
  MapPin, 
  Star, 
  ChevronRight, 
  Menu, 
  X,
  Heart,
  Cake,
  Plus,
  Minus,
  Trash2,
  History,
  RefreshCw,
  CheckCircle2,
  PartyPopper,
  User as UserIcon,
  LogOut,
  LogIn
} from 'lucide-react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  Timestamp,
  User,
  getDocFromServer
} from './firebase';

declare const Razorpay: any;

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  state: { hasError: boolean; error: Error | null } = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.operationType) {
          errorMessage = `Database Error: ${parsed.error} (during ${parsed.operationType} on ${parsed.path})`;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-red-50">
          <div className="max-w-md w-full bg-white p-8 rounded-[32px] shadow-xl border border-red-100 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <X size={32} />
            </div>
            <h2 className="text-2xl font-bold text-text mb-4">Application Error</h2>
            <p className="text-text/60 mb-8 break-words">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 bg-text text-white font-bold rounded-2xl hover:bg-text/90 transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return (this as any).props.children;
  }
}

// --- Context ---

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const isLoggingIn = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Sync user to Firestore
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: new Date().toISOString()
        }, { merge: true });

        // Check if admin
        const adminEmail = 'DevashishRaikwar55@gmail.com';
        const isUserAdmin = user.email?.toLowerCase() === adminEmail.toLowerCase();
        setIsAdmin(isUserAdmin);
        
        if (isUserAdmin) {
          console.log("Admin access granted for:", user.email);
        }
      } else {
        setIsAdmin(false);
      }
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async () => {
    if (isLoggingIn.current) return;
    isLoggingIn.current = true;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user' || error.name === 'AbortError') {
        console.log("Login cancelled by user");
      } else {
        console.error("Login failed:", error);
      }
    } finally {
      isLoggingIn.current = false;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

// --- Types ---

interface Cupcake {
  name: string;
  description: string;
  image: string;
  price: number;
}

interface CartItem extends Cupcake {
  quantity: number;
}

// --- Components ---

const ThankYouPopup = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white rounded-[32px] p-8 md:p-12 max-w-lg w-full text-center shadow-2xl overflow-hidden"
          >
            {/* Decorative background elements */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-secondary/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-secondary/10 rounded-full blur-3xl" />
            
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', damping: 12 }}
              className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner"
            >
              <CheckCircle2 size={48} strokeWidth={2.5} />
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h2 className="text-4xl font-bold mb-4 text-text">Sweet Success!</h2>
              <p className="text-lg text-text/60 mb-8 leading-relaxed">
                Thanks bhai shopping karne ke liye jaldi vapas aana! Your order is confirmed and we're already baking.
              </p>
              
              <div className="bg-[#ffe3f3] rounded-2xl p-6 mb-10 flex items-center gap-4 text-left">
                <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center text-[#e6758c] shrink-0">
                  <PartyPopper size={24} />
                </div>
                <p className="text-[16px] leading-[22px] font-bold text-[#e47390] text-left">
                  I'll miss you ok, jitna tera partner bhi nahi karta hoga! 😉
                </p>
              </div>
              
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 bg-text text-white font-bold rounded-2xl shadow-xl shadow-text/20 hover:bg-text/90 transition-all"
              >
                Continue Exploring
              </motion.button>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const Navbar = ({ cartCount, onCartClick, onAdminClick }: { cartCount: number; onCartClick: () => void; onAdminClick: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, login, logout, isAdmin } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const links = [
    { name: 'Home', href: '#' },
    { name: 'Cupcakes', href: '#menu' },
    { name: 'Our Story', href: '#story' },
    { name: 'Location', href: '#location' },
    { name: 'Contact', href: '#contact' },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 backdrop-blur-lg py-4 shadow-sm' : 'bg-transparent py-6'}`}>
      <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
        <a href="#" className="text-2xl font-bold font-display text-text flex items-center gap-2">
          <div className="w-10 h-10 bg-[#f5b9cb] rounded-full flex items-center justify-center text-white">
            <Cake size={20} />
          </div>
          Futjaa Cakes
        </a>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <motion.a 
              key={link.name} 
              href={link.href} 
              whileHover={{ scale: 1.1, color: '#f5b9cb' }}
              className="text-sm font-medium transition-colors"
            >
              {link.name}
            </motion.a>
          ))}
          
          <motion.button 
            onClick={onCartClick}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="relative p-2 text-text hover:text-secondary transition-colors"
          >
            <ShoppingBag size={24} />
            <AnimatePresence mode="popLayout">
              {cartCount > 0 && (
                <motion.span
                  key={cartCount}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className="absolute -top-1 -right-1 bg-secondary text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
                >
                  {cartCount}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {user ? (
            <div className="flex items-center gap-4">
              {isAdmin && (
                <motion.button
                  onClick={onAdminClick}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 text-xs font-bold bg-secondary/10 text-secondary px-3 py-1.5 rounded-full hover:bg-secondary/20 transition-colors"
                >
                  Admin
                </motion.button>
              )}
              <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ''} className="w-6 h-6 rounded-full" />
                ) : (
                  <UserIcon size={16} />
                )}
                <span className="text-xs font-bold truncate max-w-[80px]">{user.displayName?.split(' ')[0]}</span>
              </div>
              <motion.button
                onClick={logout}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 text-text/60 hover:text-red-500 transition-colors"
                title="Logout"
              >
                <LogOut size={20} />
              </motion.button>
            </div>
          ) : (
            <motion.button
              onClick={login}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 text-sm font-bold bg-gray-100 px-4 py-2 rounded-full hover:bg-gray-200 transition-colors"
            >
              <LogIn size={18} />
              Login
            </motion.button>
          )}

          <motion.a 
            href="#menu" 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="pill-button bg-text text-white text-sm"
          >
            Order Now
          </motion.a>
        </div>

        {/* Mobile Actions */}
        <div className="flex items-center gap-4 md:hidden">
          <motion.button 
            onClick={onCartClick}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="relative p-2 text-text"
          >
            <ShoppingBag size={24} />
            <AnimatePresence mode="popLayout">
              {cartCount > 0 && (
                <motion.span
                  key={cartCount}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className="absolute -top-1 -right-1 bg-secondary text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
                >
                  {cartCount}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
          <motion.button 
            className="text-text" 
            onClick={() => setIsOpen(!isOpen)}
            whileTap={{ scale: 0.8 }}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </motion.button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-full left-0 right-0 bg-white border-t border-gray-100 p-6 flex flex-col gap-4 md:hidden shadow-xl"
          >
            {links.map((link) => (
              <a 
                key={link.name} 
                href={link.href} 
                onClick={() => setIsOpen(false)}
                className="text-lg font-medium py-2 border-b border-gray-50"
              >
                {link.name}
              </a>
            ))}
            <a href="#menu" onClick={() => setIsOpen(false)} className="pill-button bg-secondary text-white text-center mt-4">
              Order Now
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const CartDrawer = ({ 
  isOpen, 
  onClose, 
  cart, 
  updateQuantity, 
  removeItem,
  clearCart,
  addToCart,
  onPaymentSuccess
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  cart: CartItem[];
  updateQuantity: (name: string, delta: number) => void;
  removeItem: (name: string) => void;
  clearCart: () => void;
  addToCart: (cupcake: Cupcake) => void;
  onPaymentSuccess: () => void;
}) => {
  const [isSuccess, setIsSuccess] = useState(false);
  const [view, setView] = useState<'cart' | 'history'>('cart');
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const { user, login } = useAuth();
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  useEffect(() => {
    if (!isOpen) {
      setIsSuccess(false);
      setView('cart');
    } else if (view === 'history' && user) {
      const q = query(
        collection(db, 'orders'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      setIsLoadingHistory(true);
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOrderHistory(orders);
        setIsLoadingHistory(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'orders');
        setIsLoadingHistory(false);
      });

      return () => unsubscribe();
    }
  }, [isOpen, view, user]);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!user) {
      alert("Please login to place an order");
      login();
      return;
    }

    try {
      // 1. Create order on the server
      const response = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: total,
          items: cart,
          currency: 'INR',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to create Razorpay order');
      }

      const order = await response.json();
      console.log('Order created successfully:', order);

      // 1.5 Save order to Firestore (pending)
      const orderRef = doc(db, 'orders', order.id);
      await setDoc(orderRef, {
        orderId: order.id,
        userId: user.uid,
        amount: order.amount,
        currency: order.currency,
        status: 'pending',
        items: cart.map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image
        })),
        createdAt: new Date().toISOString()
      });

      const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
      console.log('Using Razorpay Key:', razorpayKey ? 'Found' : 'NOT FOUND');

      if (!razorpayKey) {
        alert('Razorpay Key ID is missing in the frontend environment!');
        return;
      }

      // 2. Open Razorpay Checkout
      const options = {
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency,
        name: 'Futjaa Cakes',
        description: 'Cupcake Order',
        order_id: order.id,
        handler: async function (response: any) {
          console.log('Payment Success Response:', response);
          
          try {
            // Verify payment on server
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                order_id: order.id,
                payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature
              })
            });
            
            if (verifyRes.ok) {
              // Update Firestore status
              const orderRef = doc(db, 'orders', order.id);
              await setDoc(orderRef, { status: 'completed' }, { merge: true });
            } else {
              console.error('Payment verification failed on server');
            }
          } catch (err) {
            console.error('Error during verification fetch:', err);
          }

          setIsSuccess(true);
          onPaymentSuccess();
          setTimeout(() => {
            clearCart();
            onClose();
          }, 3000);
        },
        prefill: {
          name: 'Customer',
          email: 'customer@example.com',
          contact: '9999999999',
        },
        theme: {
          color: '#f5b9cb',
        },
        modal: {
          ondismiss: function() {
            console.log('Checkout modal closed by user');
          }
        }
      };

      console.log('Initializing Razorpay with options:', { ...options, key: '***' });
      
      if (typeof Razorpay === 'undefined') {
        alert('Razorpay SDK not loaded! Please check your internet connection or index.html');
        return;
      }

      const rzp = new Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        console.error('Payment Failed:', response.error);
        alert('Payment failed: ' + response.error.description);
      });
      
      console.log('Opening Razorpay modal...');
      rzp.open();
    } catch (error: any) {
      console.error('Checkout Error:', error);
      alert('Checkout Error:\n' + (error.message || 'Something went wrong'));
    }
  };

  const handleReorder = (items: CartItem[]) => {
    items.forEach(item => {
      // Add each item to cart
      // We need to match the Cupcake interface
      const cupcake: Cupcake = {
        name: item.name,
        description: item.description,
        image: item.image,
        price: item.price
      };
      // We add it multiple times based on quantity
      for (let i = 0; i < item.quantity; i++) {
        addToCart(cupcake);
      }
    });
    setView('cart');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
          />
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-[70] shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <ShoppingBag className="text-secondary" />
                  Your Cart
                </h2>
                <motion.button 
                  onClick={onClose} 
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={24} />
                </motion.button>
              </div>
              
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button 
                  onClick={() => setView('cart')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${view === 'cart' ? 'bg-white shadow-sm text-secondary' : 'text-text/40'}`}
                >
                  Active Cart
                </button>
                <button 
                  onClick={() => setView('history')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${view === 'history' ? 'bg-white shadow-sm text-secondary' : 'text-text/40'}`}
                >
                  <History size={14} />
                  History
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isSuccess ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="h-full flex flex-col items-center justify-center text-center space-y-4"
                >
                  <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                    <Star size={40} fill="currentColor" />
                  </div>
                  <h3 className="text-2xl font-bold">Order Placed!</h3>
                  <p className="text-text/60">Thank you for choosing Futjaa Cakes. Your cupcakes are being prepared with love!</p>
                </motion.div>
              ) : view === 'history' ? (
                <div className="space-y-6">
                  {isLoadingHistory ? (
                    <div className="flex justify-center py-12">
                      <RefreshCw className="animate-spin text-secondary" size={32} />
                    </div>
                  ) : orderHistory.length === 0 ? (
                    <div className="text-center py-12 opacity-50">
                      <History size={48} className="mx-auto mb-4" />
                      <p>No previous orders found</p>
                    </div>
                  ) : (
                    orderHistory.map((order) => (
                      <div key={order.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="text-[10px] font-bold text-text/40 uppercase tracking-wider">Order #{order.id.slice(-6)}</p>
                            <p className="text-xs text-text/60">{new Date(order.created_at).toLocaleDateString()}</p>
                          </div>
                          <p className="font-bold text-secondary">₹{order.amount / 100}</p>
                        </div>
                        <div className="space-y-2 mb-4">
                          {order.items.map((item: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-text/70">{item.name} x {item.quantity}</span>
                              <span className="font-medium">₹{item.price * item.quantity}</span>
                            </div>
                          ))}
                        </div>
                        <motion.button
                          onClick={() => handleReorder(order.items)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full py-2 bg-white border border-secondary/20 text-secondary text-xs font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-secondary hover:text-white transition-all"
                        >
                          <RefreshCw size={14} />
                          Reorder All
                        </motion.button>
                      </div>
                    ))
                  )}
                </div>
              ) : cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                  <ShoppingBag size={64} strokeWidth={1} />
                  <p className="text-lg">Your cart is empty</p>
                  <motion.button 
                    onClick={onClose} 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="text-secondary font-bold"
                  >
                    Start Shopping
                  </motion.button>
                </div>
              ) : (
                cart.map((item) => (
                  <motion.div 
                    key={item.name} 
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex gap-4 items-center"
                  >
                    <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold">{item.name}</h3>
                      <p className="text-sm text-text/80">₹{item.price}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <motion.button 
                          onClick={() => updateQuantity(item.name, -1)}
                          whileHover={{ scale: 1.1, backgroundColor: '#f3f4f6' }}
                          whileTap={{ scale: 0.9 }}
                          className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center transition-colors"
                        >
                          <Minus size={14} />
                        </motion.button>
                        <span className="font-bold text-sm w-4 text-center">{item.quantity}</span>
                        <motion.button 
                          onClick={() => updateQuantity(item.name, 1)}
                          whileHover={{ scale: 1.1, backgroundColor: '#f3f4f6' }}
                          whileTap={{ scale: 0.9 }}
                          className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center transition-colors"
                        >
                          <Plus size={14} />
                        </motion.button>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">₹{item.price * item.quantity}</p>
                      <motion.button 
                        onClick={() => removeItem(item.name)}
                        whileHover={{ scale: 1.2, color: '#ef4444' }}
                        whileTap={{ scale: 0.8 }}
                        className="text-red-400 p-2 transition-colors"
                      >
                        <Trash2 size={18} />
                      </motion.button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {!isSuccess && cart.length > 0 && (
              <div className="p-6 border-t bg-gray-50 space-y-4">
                <div className="flex justify-between items-center text-xl font-bold">
                  <span>Total</span>
                  <span>₹{total}</span>
                </div>
                <motion.button 
                  onClick={handleCheckout}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="pill-button bg-secondary text-white w-full text-center block shadow-lg shadow-secondary/30"
                >
                  Checkout
                </motion.button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const Hero = () => {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <span className="inline-block px-4 py-1 rounded-full bg-secondary/20 text-secondary text-xs font-bold uppercase tracking-wider mb-6">
            Freshly Baked in Amravati
          </span>
          <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] mb-6">
            Handmade Cupcakes <span className="text-secondary">Custom Designed</span>
          </h1>
          <p className="text-lg text-text/70 mb-10 max-w-lg leading-relaxed">
            Freshly baked cupcakes crafted with love in Amravati. Perfect for birthdays, celebrations, and custom surprises.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative"
        >
          <div className="aspect-square rounded-[3rem] overflow-hidden shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-700">
            <img 
              src="https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?auto=format&fit=crop&q=80&w=1000" 
              alt="Delicious Cupcakes" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const MenuSection = ({ onAddToCart }: { onAddToCart: (item: Cupcake) => void }) => {
  const cupcakes: Cupcake[] = [
    { name: "Chocolate Bliss", price: 59, description: "Rich chocolate cupcake topped with creamy frosting.", image: "https://images.unsplash.com/photo-1587668178277-295251f900ce?auto=format&fit=crop&q=80&w=500" },
    { name: "Red Velvet Dream", price: 59, description: "Classic red velvet cupcake with smooth cream topping.", image: "https://images.unsplash.com/photo-1614707267537-b85aaf00c4b7?auto=format&fit=crop&q=80&w=500" },
    { name: "Vanilla Cream Delight", price: 59, description: "Light vanilla cupcake with fluffy cream frosting.", image: "https://images.unsplash.com/photo-1550617931-e17a7b70dce2?auto=format&fit=crop&q=80&w=500" },
    { name: "Strawberry Sweetheart", price: 59, description: "Fresh strawberry cupcake with sweet glaze.", image: "https://images.unsplash.com/photo-1599785209707-a456fc1337bb?auto=format&fit=crop&q=80&w=500" },
    { name: "Choco Caramel Crunch", price: 59, description: "Chocolate cupcake with caramel drizzle and crunch.", image: "https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&q=80&w=500" },
    { name: "Oreo Surprise", price: 59, description: "Oreo infused cupcake with cookies and cream topping.", image: "https://images.unsplash.com/photo-1559622214-f8a9850965bb?auto=format&fit=crop&q=80&w=500" },
  ];

  return (
    <section id="menu" className="py-24 bg-white/50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">Our Signature Cupcakes</h2>
          <p className="text-text/60 max-w-2xl mx-auto">Handpicked flavors designed to make every bite a celebration.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {cupcakes.map((item, idx) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ y: -10 }}
              className="glass-card overflow-hidden group flex flex-col"
            >
              <div className="aspect-[4/3] overflow-hidden relative">
                <img 
                  src={item.image} 
                  alt={item.name} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                />
                <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full font-bold text-text shadow-sm">
                  ₹{item.price}
                </div>
              </div>
              <div className="p-8 flex-1 flex flex-col">
                <h3 className="text-xl font-bold mb-2">{item.name}</h3>
                <p className="text-sm text-text/60 mb-6 flex-1">{item.description}</p>
                <div className="flex items-center justify-between mt-auto">
                  <motion.button 
                    onClick={() => onAddToCart(item)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="pill-button bg-secondary text-white text-sm flex items-center gap-2 hover:bg-secondary/90 w-full justify-center"
                  >
                    <ShoppingBag size={16} />
                    Add to Cart
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const CustomOrders = () => {
  return (
    <section id="custom" className="py-24">
      <div className="max-w-7xl mx-auto px-6">
        <div className="bg-primary rounded-[3rem] p-12 md:p-20 relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-secondary/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/30 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />

          <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">Custom Cupcakes Made Just For You</h2>
              <p className="text-lg text-text/70 mb-10">
                From birthdays to surprise gifts, we design cupcakes that match your celebration theme. Tell us your vision, and we'll bake it to life.
              </p>
              <motion.a 
                href="#menu" 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="pill-button bg-text text-white inline-block"
              >
                Order Now
              </motion.a>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4 pt-8">
                <motion.img 
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  src="https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&q=80&w=400" 
                  alt="Custom 1" 
                  className="rounded-2xl shadow-lg" 
                  referrerPolicy="no-referrer" 
                />
                <motion.img 
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  src="https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&q=80&w=400" 
                  alt="Custom 2" 
                  className="rounded-2xl shadow-lg" 
                  referrerPolicy="no-referrer" 
                />
              </div>
              <div className="space-y-4">
                <motion.img 
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  src="https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?auto=format&fit=crop&q=80&w=400" 
                  alt="Custom 3" 
                  className="rounded-2xl shadow-lg" 
                  referrerPolicy="no-referrer" 
                />
                <motion.img 
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 }}
                  src="https://images.unsplash.com/photo-1614707267537-b85aaf00c4b7?auto=format&fit=crop&q=80&w=400" 
                  alt="Custom 4" 
                  className="rounded-2xl shadow-lg" 
                  referrerPolicy="no-referrer" 
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

interface GalleryItemProps {
  initialImage: string;
  pool: string[];
  slotIdx: number;
  aspectRatio: string;
  key?: React.Key;
}

const GalleryItem = ({ initialImage, pool, slotIdx, aspectRatio }: GalleryItemProps) => {
  const [currentImage, setCurrentImage] = useState(initialImage);

  useEffect(() => {
    const getRandomDelay = () => Math.floor(Math.random() * 5000) + 3000;
    let timeoutId: NodeJS.Timeout;

    const changeImage = () => {
      setCurrentImage(prev => {
        let next;
        do {
          next = pool[Math.floor(Math.random() * pool.length)];
        } while (next === prev);
        return next;
      });
      timeoutId = setTimeout(changeImage, getRandomDelay());
    };

    timeoutId = setTimeout(changeImage, getRandomDelay());
    return () => clearTimeout(timeoutId);
  }, [pool]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      whileHover={{ scale: 1.02 }}
      className={`rounded-3xl overflow-hidden shadow-sm relative ${aspectRatio}`}
    >
      <AnimatePresence mode="wait">
        <motion.img 
          key={currentImage}
          src={currentImage} 
          alt={`Gallery ${slotIdx}`} 
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          className="w-full h-full object-cover" 
          referrerPolicy="no-referrer" 
          loading="lazy" 
        />
      </AnimatePresence>
    </motion.div>
  );
};

const Gallery = () => {
  const pools = {
    square: [
      "https://images.unsplash.com/photo-1550617931-e17a7b70dce2?auto=format&fit=crop&q=80&w=600&h=600",
      "https://images.unsplash.com/photo-1576618148400-f54bed99fcfd?auto=format&fit=crop&q=80&w=600&h=600",
      "https://images.unsplash.com/photo-1599785209707-a456fc1337bb?auto=format&fit=crop&q=80&w=600&h=600",
      "https://images.unsplash.com/photo-1535141192574-5d4897c12636?auto=format&fit=crop&q=80&w=600&h=600",
    ],
    portrait: [
      "https://images.unsplash.com/photo-1587668178277-295251f900ce?auto=format&fit=crop&q=80&w=600&h=800",
      "https://images.unsplash.com/photo-1614707267537-b85aaf00c4b7?auto=format&fit=crop&q=80&w=600&h=800",
      "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&q=80&w=600&h=800",
      "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&q=80&w=600&h=800",
    ],
    landscape: [
      "https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&q=80&w=800&h=600",
      "https://images.unsplash.com/photo-1572451479139-6a308211d8be?auto=format&fit=crop&q=80&w=800&h=600",
      "https://images.unsplash.com/photo-1519340333755-56e9c1d04579?auto=format&fit=crop&q=80&w=800&h=600",
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&q=80&w=800&h=600",
    ]
  };

  const slots = [
    { type: 'square', ratio: 'aspect-square' },
    { type: 'portrait', ratio: 'aspect-[3/4]' },
    { type: 'landscape', ratio: 'aspect-[4/3]' },
    { type: 'portrait', ratio: 'aspect-[3/4]' },
    { type: 'square', ratio: 'aspect-square' },
    { type: 'landscape', ratio: 'aspect-[4/3]' },
  ];

  return (
    <section id="gallery" className="py-24 bg-white/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-4xl font-bold mb-2">Cupcake Moments</h2>
            <p className="text-text/60">A glimpse into our sweet creations.</p>
          </div>
          <motion.a 
            href="#" 
            whileHover={{ scale: 1.05, x: 5 }}
            whileTap={{ scale: 0.95 }}
            className="hidden md:flex items-center gap-2 text-secondary font-bold"
          >
            Follow on Instagram <Instagram size={20} />
          </motion.a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {slots.map((slot, idx) => (
            <GalleryItem 
              key={idx} 
              initialImage={pools[slot.type as keyof typeof pools][0]} 
              pool={pools[slot.type as keyof typeof pools]} 
              slotIdx={idx}
              aspectRatio={slot.ratio}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

const OurStory = () => {
  return (
    <section id="story" className="py-24 bg-primary/10 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
        <div className="absolute top-10 left-10 animate-pulse">
          <Star size={40} />
        </div>
        <div className="absolute bottom-20 right-20 animate-bounce">
          <Cake size={60} />
        </div>
      </div>
      
      <div className="max-w-4xl mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1 rounded-full bg-secondary/20 text-secondary text-xs font-bold uppercase tracking-widest mb-4">
            The Legend
          </span>
          <h2 className="text-5xl md:text-6xl font-bold mb-6">Our Story</h2>
          <div className="w-24 h-1 bg-secondary mx-auto rounded-full" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="glass-card p-12 md:p-20 text-center shadow-2xl border-white/40"
        >
          <div className="prose prose-lg max-w-none text-text/80 leading-relaxed space-y-8">
            <p className="text-xl md:text-2xl font-serif italic text-[#f57c9f]">
              "Once upon a time there lived legendary Gujar Sameer Aryabhatt and the great Swami Devaa Shrichakradhar—the world-famous billionaires..."
            </p>
            
            <p>
              They were out on a little space mission– busy deciding which moon we should colonize next? 
              But then, they looked down from space and saw a total kaand happening.
            </p>

            <p>
              It was Shri Shri Urjaa Bhattacharya Das. We saw her literally snatching a cupcake from a tiny little baby and running away like a professional thief! 
              The great legendary Gujar Sameer Aryabhatt looked at the great Swami Devaa Shrichakradhar and said, 
              <span className="block font-bold text-text mt-4">"Bhai, this is so bad. Our friend is out there bullying kids for snacks. We should do something for her."</span>
            </p>

            <p>
              We felt so bad for your "condition" that we decided to fix it in a legendary way. They both flew out of the Milky Way on the rarest RED planet, 
              and they collected the legendary rare ingredient, colors and sugar. They took those rare ingredients from the other planet and built a brand-new, 
              magical million-dollar company from scratch.
            </p>

            <div className="py-10">
              <h3 className="text-3xl md:text-4xl font-bold text-text mb-2">And that is how the world famous</h3>
              <p className="text-5xl md:text-6xl font-display text-secondary font-bold tracking-tighter">"futjaa cupcakes"</p>
              <p className="text-xl mt-2 opacity-60">brand was found.</p>
            </div>

            <p className="text-lg font-medium">
              AND then both kind hearted friends decided to hand over this whole big massive empire to their friend..
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const LocationSection = () => {
  return (
    <section id="location" className="py-24 bg-white/50">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-4xl font-bold mb-6">Visit Us</h2>
          <p className="text-lg text-text/60 mb-8">
            We are located in the heart of Amravati. Come visit us for a fresh batch of cupcakes or pick up your custom orders.
          </p>
          <div className="flex items-start gap-4 mb-10">
            <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary shrink-0">
              <MapPin size={24} />
            </div>
            <div>
              <p className="font-bold mb-1">Amravati, Maharashtra</p>
              <p className="text-sm text-text/50">India, 444601</p>
            </div>
          </div>
          <motion.a 
            href="https://maps.google.com/?q=Amravati+Maharashtra" 
            whileHover={{ scale: 1.05, x: 5 }}
            whileTap={{ scale: 0.95 }}
            className="pill-button bg-text text-white inline-flex items-center gap-2"
          >
            Open in Google Maps
            <ChevronRight size={18} />
          </motion.a>
        </div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="aspect-video rounded-[2rem] overflow-hidden shadow-xl border-8 border-white"
        >
          <iframe 
            src="https://maps.google.com/maps?q=Amravati,Maharashtra&t=&z=13&ie=UTF8&iwloc=&output=embed" 
            className="w-full h-full border-0"
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </motion.div>
      </div>
    </section>
  );
};

const ContactSection = () => {
  return (
    <section id="contact" className="py-24">
      <div className="max-w-7xl mx-auto px-6 text-center">
        <h2 className="text-5xl md:text-6xl font-bold mb-8">Let's Bake Something Sweet</h2>
        <p className="text-xl text-text/60 mb-12 max-w-2xl mx-auto">
          Have a special request or just want to say hi? We're just a message away.
        </p>
        
        <div className="flex flex-col md:flex-row justify-center items-center gap-8 mb-16">
          <div className="flex items-center gap-3">
            <Phone size={20} className="text-secondary" />
            <span className="font-bold text-lg">82088 17887</span>
          </div>
          <div className="w-2 h-2 rounded-full bg-secondary/30 hidden md:block" />
          <div className="flex items-center gap-3">
            <Instagram size={20} className="text-secondary" />
            <span className="font-bold text-lg">@futjaacakes</span>
          </div>
          <div className="w-2 h-2 rounded-full bg-secondary/30 hidden md:block" />
          <div className="flex items-center gap-3">
            <Cake size={20} className="text-secondary" />
            <span className="font-bold text-lg">xyz@email.com</span>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <motion.a 
            href="#menu" 
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
            className="pill-button bg-secondary text-white shadow-lg shadow-secondary/30"
          >
            Order Now
          </motion.a>
          <motion.a 
            href="tel:8208817887" 
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
            className="pill-button border-2 border-text/10"
          >
            Call Now
          </motion.a>
        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  return (
    <footer className="bg-text text-white/90 py-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-20">
          <div className="md:col-span-2">
            <a href="#" className="text-3xl font-bold font-display text-white flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center text-white">
                <Cake size={24} />
              </div>
              Futjaa Cakes
            </a>
            <p className="text-white/60 max-w-sm leading-relaxed">
              Handmade cupcakes crafted with love in Amravati. We believe every celebration deserves a touch of sweetness.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold mb-6 text-white uppercase tracking-widest text-xs">Quick Links</h4>
            <ul className="space-y-4 text-sm">
              <li><a href="#" className="hover:text-secondary transition-colors">Home</a></li>
              <li><a href="#menu" className="hover:text-secondary transition-colors">Cupcakes</a></li>
              <li><a href="#story" className="hover:text-secondary transition-colors">Our Story</a></li>
              <li><a href="#gallery" className="hover:text-secondary transition-colors">Gallery</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6 text-white uppercase tracking-widest text-xs">Support</h4>
            <ul className="space-y-4 text-sm">
              <li><a href="#location" className="hover:text-secondary transition-colors">Location</a></li>
              <li><a href="#contact" className="hover:text-secondary transition-colors">Contact</a></li>
              <li><a href="#" className="hover:text-secondary transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-secondary transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/40">
          <p>© 2026 Futjaa Cakes. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Instagram</a>
            <a href="#" className="hover:text-white transition-colors">Facebook</a>
            <a href="#" className="hover:text-white transition-colors">WhatsApp</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

const AdminDashboard = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (isOpen && isAdmin) {
      setLoading(true);
      
      // Listen to all orders
      const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
        setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      });

      // Listen to all users
      const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      });

      return () => {
        unsubscribeOrders();
        unsubscribeUsers();
      };
    }
  }, [isOpen, isAdmin]);

  if (!isOpen) return null;

  const totalSales = orders
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + (o.amount / 100), 0);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative bg-white rounded-[32px] w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary">
                <Star size={20} />
              </div>
              Admin Dashboard
            </h2>
            <p className="text-sm text-text/50">Manage your business at a glance</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-secondary/5 p-6 rounded-3xl border border-secondary/10">
              <p className="text-sm font-bold text-secondary uppercase tracking-wider mb-1">Total Revenue</p>
              <h3 className="text-3xl font-bold">₹{totalSales.toLocaleString()}</h3>
            </div>
            <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
              <p className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-1">Total Orders</p>
              <h3 className="text-3xl font-bold">{orders.length}</h3>
            </div>
            <div className="bg-green-50 p-6 rounded-3xl border border-green-100">
              <p className="text-sm font-bold text-green-600 uppercase tracking-wider mb-1">Total Customers</p>
              <h3 className="text-3xl font-bold">{users.length}</h3>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Recent Orders */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <ShoppingBag size={20} className="text-secondary" />
                Recent Orders
              </h3>
              <div className="space-y-3">
                {orders.slice(0, 10).map((order) => (
                  <div key={order.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm">Order #{order.orderId.slice(-6)}</p>
                      <p className="text-xs text-text/50">
                        {order.items.length} items • ₹{order.amount / 100}
                      </p>
                      <p className="text-[10px] text-text/40 mt-1">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      order.status === 'completed' ? 'bg-green-100 text-green-600' : 
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-600' : 
                      'bg-red-100 text-red-600'
                    }`}>
                      {order.status}
                    </div>
                  </div>
                ))}
                {orders.length === 0 && <p className="text-sm text-text/40 text-center py-8">No orders yet.</p>}
              </div>
            </div>

            {/* Recent Customers */}
            <div className="space-y-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <UserIcon size={20} className="text-secondary" />
                Recent Customers
              </h3>
              <div className="space-y-3">
                {users.slice(0, 10).map((user) => (
                  <div key={user.uid} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center gap-4">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-400">
                        <UserIcon size={20} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{user.displayName || 'Anonymous'}</p>
                      <p className="text-xs text-text/50 truncate">{user.email}</p>
                    </div>
                    <p className="text-[10px] text-text/40 shrink-0">
                      Joined {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
                {users.length === 0 && <p className="text-sm text-text/40 text-center py-8">No customers yet.</p>}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

function AppContent() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const { user, login } = useAuth();

  const addToCart = (cupcake: Cupcake) => {
    if (!user) {
      login();
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.name === cupcake.name);
      if (existing) {
        return prev.map(item => 
          item.name === cupcake.name 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, { ...cupcake, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateQuantity = (name: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.name === name) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeItem = (name: string) => {
    setCart(prev => prev.filter(item => item.name !== name));
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  return (
    <div className="min-h-screen selection:bg-secondary selection:text-white">
      <Navbar 
        cartCount={cartCount} 
        onCartClick={() => setIsCartOpen(true)} 
        onAdminClick={() => setIsAdminOpen(true)}
      />
      
      <CartDrawer 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
        cart={cart}
        updateQuantity={updateQuantity}
        removeItem={removeItem}
        clearCart={clearCart}
        addToCart={addToCart}
        onPaymentSuccess={() => setShowThankYou(true)}
      />

      <ThankYouPopup 
        isOpen={showThankYou} 
        onClose={() => setShowThankYou(false)} 
      />

      <AdminDashboard 
        isOpen={isAdminOpen} 
        onClose={() => setIsAdminOpen(false)} 
      />

      {/* Floating Background Elements */}
      <main>
        <Hero />
        <MenuSection onAddToCart={addToCart} />
        <CustomOrders />
        <Gallery />
        <OurStory />
        <LocationSection />
        <ContactSection />
      </main>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
