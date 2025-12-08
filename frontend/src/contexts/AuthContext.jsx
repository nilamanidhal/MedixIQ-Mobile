import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    // Use the environment variable for the API base URL
    const API_BASE_URL = import.meta.env.VITE_API_URL;
    axios.defaults.baseURL = API_BASE_URL;

    // This effect runs whenever the token changes and sets the default auth header for all future axios requests
    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            fetchUserProfile();
        } else {
            delete axios.defaults.headers.common['Authorization'];
            setLoading(false);
        }
    }, [token]);

    const fetchUserProfile = async () => {
        try {
            const response = await axios.get('/auth/profile');
            setUser(response.data.user);
        } catch (error) {
            console.error('Error fetching user profile:', error);
            logout(); // If profile fetch fails, the token is likely invalid, so log out
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            const response = await axios.post('/auth/login', { email, password });
            const { token, user } = response.data;
            localStorage.setItem('token', token);
            setToken(token);
            setUser(user);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || 'Network error' };
        }
    };

    const register = async (userData) => {
        try {
            const response = await axios.post('/auth/register', userData);
            const { token, user } = response.data;
            localStorage.setItem('token', token);
            setToken(token);
            setUser(user);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || 'Network error' };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    };
    
    const updateProfile = async (profileData) => {
        try {
            const response = await axios.put('/auth/profile', profileData);
            setUser(response.data.user);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.response?.data?.message || 'Network error' };
        }
    };


    const value = {
        user,
        token,
        loading,
        login,
        register,
        logout,
        updateProfile,
        API_BASE_URL,
    };

    return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};











// import React, { createContext, useContext, useState, useEffect } from 'react';

// const AuthContext = createContext();

// export const useAuth = () => {
//   const context = useContext(AuthContext);
//   if (!context) {
//     throw new Error('useAuth must be used within an AuthProvider');
//   }
//   return context;
// };

// export const AuthProvider = ({ children }) => {
//   const [user, setUser] = useState(null);
//   const [token, setToken] = useState(localStorage.getItem('token'));
//   const [loading, setLoading] = useState(true);

//   // const API_BASE_URL = 'http://localhost:5000/api';  //Devlopment mode
//   const API_BASE_URL = 'https://medmind-qnpv.onrender.com/api'; // Deployment mode

//   useEffect(() => {
//     if (token) {
//       fetchUserProfile();
//     } else {
//       setLoading(false);
//     }
//   }, [token]);

//   const fetchUserProfile = async () => {
//     try {
//       const response = await fetch(`${API_BASE_URL}/auth/profile`, {
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//       });

//       if (response.ok) {
//         const data = await response.json();
//         setUser(data.user);
//       } else {
//         logout();
//       }
//     } catch (error) {
//       console.error('Error fetching user profile:', error);
//       logout();
//     } finally {
//       setLoading(false);
//     }
//   };

//   const login = async (email, password) => {
//     try {
//       const response = await fetch(`${API_BASE_URL}/auth/login`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ email, password }),
//       });

//       const data = await response.json();

//       if (response.ok) {
//         localStorage.setItem('token', data.token);
//         setToken(data.token);
//         setUser(data.user);
//         return { success: true };
//       } else {
//         return { success: false, message: data.message };
//       }
//     } catch (error) {
//       return { success: false, message: 'Network error. Please try again.' };
//     }
//   };

//   const register = async (userData) => {
//     try {
//       const response = await fetch(`${API_BASE_URL}/auth/register`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(userData),
//       });

//       const data = await response.json();

//       if (response.ok) {
//         localStorage.setItem('token', data.token);
//         setToken(data.token);
//         setUser(data.user);
//         return { success: true };
//       } else {
//         return { success: false, message: data.message };
//       }
//     } catch (error) {
//       return { success: false, message: 'Network error. Please try again.' };
//     }
//   };

//   const logout = () => {
//     localStorage.removeItem('token');
//     setToken(null);
//     setUser(null);
//   };

//   const updateProfile = async (profileData) => {
//     try {
//       const response = await fetch(`${API_BASE_URL}/auth/profile`, {
//         method: 'PUT',
//         headers: {
//           'Authorization': `Bearer ${token}`,
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(profileData),
//       });

//       const data = await response.json();

//       if (response.ok) {
//         setUser(data.user);
//         return { success: true };
//       } else {
//         return { success: false, message: data.message };
//       }
//     } catch (error) {
//       return { success: false, message: 'Network error. Please try again.' };
//     }
//   };

//   const value = {
//     user,
//     token,
//     loading,
//     login,
//     register,
//     logout,
//     updateProfile,
//     API_BASE_URL,
//   };

//   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
// };