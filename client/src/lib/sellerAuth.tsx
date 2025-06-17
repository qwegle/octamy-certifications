import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface Seller {
  id: number;
  email: string;
  name: string;
  isApproved: boolean;
  totalEarnings: string;
  pendingEarnings: string;
}

interface SellerAuthContextType {
  seller: Seller | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, phone?: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const SellerAuthContext = createContext<SellerAuthContextType | undefined>(undefined);

export function SellerAuthProvider({ children }: { children: ReactNode }) {
  const [seller, setSeller] = useState<Seller | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("sellerToken");
    if (storedToken) {
      setToken(storedToken);
      // Verify token and get seller data
      fetchSellerData(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchSellerData = async (authToken: string) => {
    try {
      const response = await fetch("/api/sellers/dashboard", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSeller(data.seller);
      } else if (response.status === 401 || response.status === 403) {
        // Token expired or invalid - clear and force re-login
        localStorage.removeItem("sellerToken");
        setToken(null);
        setSeller(null);
      } else {
        localStorage.removeItem("sellerToken");
        setToken(null);
      }
    } catch (error) {
      console.error("Error fetching seller data:", error);
      localStorage.removeItem("sellerToken");
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch("/api/sellers/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Login failed");
    }

    const data = await response.json();
    setToken(data.token);
    setSeller(data.seller);
    localStorage.setItem("sellerToken", data.token);
    
    // Redirect to partner dashboard after successful login
    setTimeout(() => {
      window.location.href = '/partner-dashboard';
    }, 100);
  };

  const register = async (email: string, password: string, name: string, phone?: string) => {
    const response = await fetch("/api/sellers/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, name, phone }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Registration failed");
    }

    const data = await response.json();
    setToken(data.token);
    setSeller(data.seller);
    localStorage.setItem("sellerToken", data.token);
  };

  const logout = () => {
    setSeller(null);
    setToken(null);
    localStorage.removeItem("sellerToken");
  };

  return (
    <SellerAuthContext.Provider value={{ seller, token, login, register, logout, isLoading }}>
      {children}
    </SellerAuthContext.Provider>
  );
}

export function useSellerAuth() {
  const context = useContext(SellerAuthContext);
  if (context === undefined) {
    throw new Error("useSellerAuth must be used within a SellerAuthProvider");
  }
  return context;
}