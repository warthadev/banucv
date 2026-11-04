// src/react/feature/cloudmodaltele.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, Key, AlertCircle, Eye, EyeOff, ChevronDown, X, ArrowLeft } from "lucide-react";
import { modalVariants, overlayVariants } from "@animation/githubeditor";
import { auth, db } from "@config/firebase";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { TelegramIcon } from "@control/icon";
import { getActiveBase } from "@config/api";

interface CloudModalTeleProps {
  isOpen: boolean;
  onSave: (sessionString: string, phoneNumber: string, platform: string) => Promise<void>;
  onClose: () => void;
  onBack?: () => void;
  isLoading?: boolean;
}

const countryCodes = [
  { code: "+62", country: "Indonesia", flag: "🇮🇩" },
  { code: "+91", country: "India", flag: "🇮🇳" },
  { code: "+1", country: "United States", flag: "🇺🇸" },
  { code: "+44", country: "United Kingdom", flag: "🇬🇧" },
  { code: "+61", country: "Australia", flag: "🇦🇺" },
  { code: "+81", country: "Japan", flag: "🇯🇵" },
  { code: "+82", country: "South Korea", flag: "🇰🇷" },
  { code: "+86", country: "China", flag: "🇨🇳" },
  { code: "+65", country: "Singapore", flag: "🇸🇬" },
  { code: "+60", country: "Malaysia", flag: "🇲🇾" },
  { code: "+63", country: "Philippines", flag: "🇵🇭" },
  { code: "+66", country: "Thailand", flag: "🇹🇭" },
  { code: "+84", country: "Vietnam", flag: "🇻🇳" },
  { code: "+90", country: "Turkey", flag: "🇹🇷" },
  { code: "+966", country: "Saudi Arabia", flag: "🇸🇦" },
  { code: "+971", country: "UAE", flag: "🇦🇪" },
  { code: "+55", country: "Brazil", flag: "🇧🇷" },
  { code: "+52", country: "Mexico", flag: "🇲🇽" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+39", country: "Italy", flag: "🇮🇹" },
  { code: "+34", country: "Spain", flag: "🇪🇸" },
  { code: "+7", country: "Russia", flag: "🇷🇺" },
  { code: "+27", country: "South Africa", flag: "🇿🇦" },
  { code: "+234", country: "Nigeria", flag: "🇳🇬" },
  { code: "+92", country: "Pakistan", flag: "🇵🇰" },
  { code: "+880", country: "Bangladesh", flag: "🇧🇩" },
  { code: "+977", country: "Nepal", flag: "🇳🇵" },
  { code: "+94", country: "Sri Lanka", flag: "🇱🇰" },
  { code: "+95", country: "Myanmar", flag: "🇲🇲" },
  { code: "+855", country: "Cambodia", flag: "🇰🇭" },
  { code: "+856", country: "Laos", flag: "🇱🇦" },
  { code: "+673", country: "Brunei", flag: "🇧🇳" },
  { code: "+670", country: "Timor-Leste", flag: "🇹🇱" },
  { code: "+64", country: "New Zealand", flag: "🇳🇿" },
  { code: "+20", country: "Egypt", flag: "🇪🇬" },
  { code: "+212", country: "Morocco", flag: "🇲🇦" },
  { code: "+216", country: "Tunisia", flag: "🇹🇳" },
  { code: "+213", country: "Algeria", flag: "🇩🇿" },
  { code: "+218", country: "Libya", flag: "🇱🇾" },
  { code: "+254", country: "Kenya", flag: "🇰🇪" },
  { code: "+233", country: "Ghana", flag: "🇬🇭" },
  { code: "+30", country: "Greece", flag: "🇬🇷" },
  { code: "+31", country: "Netherlands", flag: "🇳🇱" },
  { code: "+32", country: "Belgium", flag: "🇧🇪" },
  { code: "+351", country: "Portugal", flag: "🇵🇹" },
  { code: "+353", country: "Ireland", flag: "🇮🇪" },
  { code: "+354", country: "Iceland", flag: "🇮🇸" },
  { code: "+46", country: "Sweden", flag: "🇸🇪" },
  { code: "+47", country: "Norway", flag: "🇳🇴" },
  { code: "+45", country: "Denmark", flag: "🇩🇰" },
  { code: "+358", country: "Finland", flag: "🇫🇮" },
  { code: "+48", country: "Poland", flag: "🇵🇱" },
  { code: "+420", country: "Czech Republic", flag: "🇨🇿" },
  { code: "+421", country: "Slovakia", flag: "🇸🇰" },
  { code: "+36", country: "Hungary", flag: "🇭🇺" },
  { code: "+40", country: "Romania", flag: "🇷🇴" },
  { code: "+359", country: "Bulgaria", flag: "🇧🇬" },
  { code: "+385", country: "Croatia", flag: "🇭🇷" },
  { code: "+381", country: "Serbia", flag: "🇷🇸" },
  { code: "+386", country: "Slovenia", flag: "🇸🇮" },
  { code: "+356", country: "Malta", flag: "🇲🇹" },
  { code: "+357", country: "Cyprus", flag: "🇨🇾" },
  { code: "+370", country: "Lithuania", flag: "🇱🇹" },
  { code: "+371", country: "Latvia", flag: "🇱🇻" },
  { code: "+372", country: "Estonia", flag: "🇪🇪" },
  { code: "+373", country: "Moldova", flag: "🇲🇩" },
  { code: "+374", country: "Armenia", flag: "🇦🇲" },
  { code: "+375", country: "Belarus", flag: "🇧🇾" },
  { code: "+376", country: "Andorra", flag: "🇦🇩" },
  { code: "+377", country: "Monaco", flag: "🇲🇨" },
  { code: "+378", country: "San Marino", flag: "🇸🇲" },
  { code: "+379", country: "Vatican City", flag: "🇻🇦" },
  { code: "+380", country: "Ukraine", flag: "🇺🇦" },
  { code: "+382", country: "Montenegro", flag: "🇲🇪" },
  { code: "+383", country: "Kosovo", flag: "🇽🇰" },
  { code: "+387", country: "Bosnia and Herzegovina", flag: "🇧🇦" },
  { code: "+389", country: "North Macedonia", flag: "🇲🇰" },
  { code: "+41", country: "Switzerland", flag: "🇨🇭" },
  { code: "+423", country: "Liechtenstein", flag: "🇱🇮" },
  { code: "+43", country: "Austria", flag: "🇦🇹" },
  { code: "+501", country: "Belize", flag: "🇧🇿" },
  { code: "+502", country: "Guatemala", flag: "🇬🇹" },
  { code: "+503", country: "El Salvador", flag: "🇸🇻" },
  { code: "+504", country: "Honduras", flag: "🇭🇳" },
  { code: "+505", country: "Nicaragua", flag: "🇳🇮" },
  { code: "+506", country: "Costa Rica", flag: "🇨🇷" },
  { code: "+507", country: "Panama", flag: "🇵🇦" },
  { code: "+508", country: "Saint Pierre and Miquelon", flag: "🇵🇲" },
  { code: "+509", country: "Haiti", flag: "🇭🇹" },
  { code: "+51", country: "Peru", flag: "🇵🇪" },
  { code: "+53", country: "Cuba", flag: "🇨🇺" },
  { code: "+54", country: "Argentina", flag: "🇦🇷" },
  { code: "+56", country: "Chile", flag: "🇨🇱" },
  { code: "+57", country: "Colombia", flag: "🇨🇴" },
  { code: "+58", country: "Venezuela", flag: "🇻🇪" },
  { code: "+590", country: "Guadeloupe", flag: "🇬🇵" },
  { code: "+591", country: "Bolivia", flag: "🇧🇴" },
  { code: "+592", country: "Guyana", flag: "🇬🇾" },
  { code: "+593", country: "Ecuador", flag: "🇪🇨" },
  { code: "+594", country: "French Guiana", flag: "🇬🇫" },
  { code: "+595", country: "Paraguay", flag: "🇵🇾" },
  { code: "+596", country: "Martinique", flag: "🇲🇶" },
  { code: "+597", country: "Suriname", flag: "🇸🇷" },
  { code: "+598", country: "Uruguay", flag: "🇺🇾" },
  { code: "+599", country: "Curaçao", flag: "🇨🇼" },
  { code: "+672", country: "Antarctica", flag: "🇦🇶" },
  { code: "+674", country: "Nauru", flag: "🇳🇷" },
  { code: "+675", country: "Papua New Guinea", flag: "🇵🇬" },
  { code: "+676", country: "Tonga", flag: "🇹🇴" },
  { code: "+677", country: "Solomon Islands", flag: "🇸🇧" },
  { code: "+678", country: "Vanuatu", flag: "🇻🇺" },
  { code: "+679", country: "Fiji", flag: "🇫🇯" },
  { code: "+680", country: "Palau", flag: "🇵🇼" },
  { code: "+681", country: "Wallis and Futuna", flag: "🇼🇫" },
  { code: "+682", country: "Cook Islands", flag: "🇨🇰" },
  { code: "+683", country: "Niue", flag: "🇳🇺" },
  { code: "+684", country: "American Samoa", flag: "🇦🇸" },
  { code: "+685", country: "Samoa", flag: "🇼🇸" },
  { code: "+686", country: "Kiribati", flag: "🇰🇮" },
  { code: "+687", country: "New Caledonia", flag: "🇳🇨" },
  { code: "+688", country: "Tuvalu", flag: "🇹🇻" },
  { code: "+689", country: "French Polynesia", flag: "🇵🇫" },
  { code: "+690", country: "Tokelau", flag: "🇹🇰" },
  { code: "+691", country: "Micronesia", flag: "🇫🇲" },
  { code: "+692", country: "Marshall Islands", flag: "🇲🇭" },
  { code: "+93", country: "Afghanistan", flag: "🇦🇫" },
  { code: "+960", country: "Maldives", flag: "🇲🇻" },
  { code: "+961", country: "Lebanon", flag: "🇱🇧" },
  { code: "+962", country: "Jordan", flag: "🇯🇴" },
  { code: "+963", country: "Syria", flag: "🇸🇾" },
  { code: "+964", country: "Iraq", flag: "🇮🇶" },
  { code: "+965", country: "Kuwait", flag: "🇰🇼" },
  { code: "+967", country: "Yemen", flag: "🇾🇪" },
  { code: "+968", country: "Oman", flag: "🇴🇲" },
  { code: "+970", country: "Palestine", flag: "🇵🇸" },
  { code: "+972", country: "Israel", flag: "🇮🇱" },
  { code: "+973", country: "Bahrain", flag: "🇧🇭" },
  { code: "+974", country: "Qatar", flag: "🇶🇦" },
  { code: "+975", country: "Bhutan", flag: "🇧🇹" },
  { code: "+976", country: "Mongolia", flag: "🇲🇳" },
  { code: "+992", country: "Tajikistan", flag: "🇹🇯" },
  { code: "+993", country: "Turkmenistan", flag: "🇹🇲" },
  { code: "+994", country: "Azerbaijan", flag: "🇦🇿" },
  { code: "+995", country: "Georgia", flag: "🇬🇪" },
  { code: "+996", country: "Kyrgyzstan", flag: "🇰🇬" },
  { code: "+998", country: "Uzbekistan", flag: "🇺🇿" },
];

const saveSessionToFirestore = async (session: string, accountName: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("User not authenticated");
  }
  const userRef = doc(db, "users", user.uid);
  try {
    await updateDoc(userRef, {
      telegramSessions: arrayUnion(session),
      telegramAccountNames: arrayUnion(accountName),
    });
  } catch (error: any) {
    throw error;
  }
};

export const CloudModalTele: React.FC<CloudModalTeleProps> = ({
  isOpen,
  onSave,
  onClose,
  onBack,
  isLoading = false,
}) => {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [sessionString, setSessionString] = useState("");
  const [showSession, setShowSession] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(countryCodes[0]);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [phoneCodeHash, setPhoneCodeHash] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [filteredCountries, setFilteredCountries] = useState(countryCodes);
  const [showTabs, setShowTabs] = useState(true);
  const [manualName, setManualName] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setPhoneNumber("");
    setCode("");
    setPhoneCodeHash("");
    setStep("phone");
    setError("");
    setShowTabs(true);
    setManualName("");
    setSessionString("");
    setSaveSuccess(false);
    setIsSaving(false);
    setIsValidating(false);
    setIsSendingCode(false);
    setCountrySearch("");
    setFilteredCountries(countryCodes);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
      setMode("auto");
    }
  }, [isOpen, resetForm]);

  useEffect(() => {
    const filterCountries = () => {
      if (!countrySearch.trim()) {
        setFilteredCountries(countryCodes);
        return;
      }
      const search = countrySearch.toLowerCase().trim();
      const filtered = countryCodes.filter(
        (c) =>
          c.country.toLowerCase().includes(search) ||
          c.code.includes(search) ||
          c.flag.includes(search)
      );
      setFilteredCountries(filtered);
    };
    filterCountries();
  }, [countrySearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCountryDropdownOpen(false);
        setCountrySearch("");
        setFilteredCountries(countryCodes);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isCountryDropdownOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isCountryDropdownOpen]);

  useEffect(() => {
    if (step === "code") {
      setShowTabs(false);
    } else {
      setShowTabs(true);
    }
  }, [step]);

  const isValidPhoneNumber = useCallback((phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 5 && cleaned.length <= 15;
  }, []);

  const isValidCode = useCallback((code: string) => {
    return /^\d{5,6}$/.test(code);
  }, []);

  const isValidSessionString = useCallback((session: string) => {
    const isGramjs = session.length >= 10 && /^[0-9]+:/.test(session);
    const isTelethon = session.length >= 20 && /^[A-Za-z0-9+\/=_-]+$/.test(session);
    return isGramjs || isTelethon;
  }, []);

  const validateSession = useCallback(async (session: string): Promise<boolean> => {
    try {
      const API_BASE = getActiveBase();
      const res = await fetch(`${API_BASE}/telegram/validate_session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_string: session }),
      });
      const data = await res.json();
      return data.valid === true;
    } catch {
      return false;
    }
  }, []);

  const getAccountInfo = useCallback(async (session: string): Promise<string> => {
    try {
      const API_BASE = getActiveBase();
      const res = await fetch(`${API_BASE}/telegram/get_me`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Telegram-Session": session
        },
      });
      const data = await res.json();
      if (data && data.username) return data.username;
      if (data && data.first_name) return data.first_name;
      if (data && data.phone) return data.phone;
      return "Telegram Account";
    } catch {
      return "Telegram Account";
    }
  }, []);

  const handleSendCode = useCallback(async () => {
    const fullPhoneNumber = `${selectedCountry.code}${phoneNumber}`;

    if (!phoneNumber.trim()) {
      setError("Phone number required");
      return;
    }
    if (!isValidPhoneNumber(phoneNumber)) {
      setError("Invalid phone number. Must be 5-15 digits.");
      return;
    }

    setIsSendingCode(true);
    setError("");

    try {
      const API_BASE = getActiveBase();
      const res = await fetch(`${API_BASE}/telegram/send_code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: fullPhoneNumber }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || `HTTP ${res.status}`);
      }

      if (data.phone_code_hash) {
        setPhoneCodeHash(data.phone_code_hash);
        setStep("code");
        setError("");
      } else {
        throw new Error("No phone_code_hash in response");
      }
    } catch (err: any) {
      setError(err.message || "Failed to send verification code");
    } finally {
      setIsSendingCode(false);
    }
  }, [selectedCountry.code, phoneNumber, isValidPhoneNumber]);

  const handleVerifyCode = useCallback(async () => {
    const fullPhoneNumber = `${selectedCountry.code}${phoneNumber}`;

    if (!code.trim()) {
      setError("Verification code required");
      return;
    }
    if (!isValidCode(code)) {
      setError("Invalid code. Must be 5-6 digits.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const API_BASE = getActiveBase();
      const res = await fetch(`${API_BASE}/telegram/sign_in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: fullPhoneNumber,
          code: code.trim(),
          phone_code_hash: phoneCodeHash,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.detail || data.message || `HTTP ${res.status}`;
        setError(errorMsg);
        setIsSaving(false);
        return;
      }

      if (data.session_string) {
        try {
          const accountName = fullPhoneNumber;
          await saveSessionToFirestore(data.session_string, accountName);
          await onSave(data.session_string, fullPhoneNumber, "Telegram");
          resetForm();
          setMode("auto");
          setTimeout(() => {
            onClose();
          }, 300);
        } catch (saveError: any) {
          setError("Failed to save session: " + (saveError.message || "Unknown error"));
          setIsSaving(false);
        }
      } else {
        setError("No session received from server");
        setIsSaving(false);
      }
    } catch (err: any) {
      setError(err.message || "Failed to verify code");
      setIsSaving(false);
    }
  }, [selectedCountry.code, phoneNumber, code, phoneCodeHash, isValidCode, onSave, onClose, resetForm]);

  const handleManualSave = useCallback(async () => {
    if (!sessionString.trim()) {
      setError("Session string required");
      return;
    }
    if (!isValidSessionString(sessionString)) {
      setError("Invalid session format. Must be '1:xxxx...' (gramjs) or Base64 (telethon).");
      return;
    }

    setIsValidating(true);
    setError("");

    try {
      const isValid = await validateSession(sessionString.trim());
      if (!isValid) {
        setError("Invalid or expired session. Please generate a new session string.");
        setIsValidating(false);
        return;
      }

      let accountName = manualName.trim();
      if (!accountName) {
        accountName = await getAccountInfo(sessionString.trim());
      }

      setIsSaving(true);
      try {
        await saveSessionToFirestore(sessionString.trim(), accountName);
        await onSave(sessionString.trim(), accountName, "Telegram");
        resetForm();
        setMode("auto");
        setTimeout(() => {
          onClose();
        }, 300);
      } catch (saveError: any) {
        setError("Failed to save session: " + (saveError.message || "Unknown error"));
        setIsSaving(false);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save session");
      setIsSaving(false);
    } finally {
      setIsValidating(false);
    }
  }, [sessionString, manualName, isValidSessionString, validateSession, getAccountInfo, onSave, onClose, resetForm]);

  const handleBack = useCallback(() => {
    if (step === "code") {
      resetForm();
      setShowTabs(true);
    } else {
      resetForm();
      if (onBack) {
        onBack();
      }
    }
  }, [step, resetForm, onBack]);

  const handleClose = useCallback(() => {
    resetForm();
    setMode("auto");
    onClose();
  }, [resetForm, onClose]);

  const shouldShowBackButton = useCallback(() => {
    if (mode === "auto" && step === "code") {
      return true;
    }
    return false;
  }, [mode, step]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="github-modal-overlay"
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <motion.div
            className="github-modal cva-modal"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="cva-modal-header">
              {shouldShowBackButton() && (
                <button
                  className="cva-modal-back"
                  onClick={handleBack}
                  title="Back"
                >
                  <ArrowLeft size={20} />
                </button>
              )}
              <div style={{ marginLeft: 'auto' }}>
                <button
                  className="cva-modal-close"
                  onClick={handleClose}
                  title="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="cva-header">
              <div className="cva-icon-wrapper">
                <TelegramIcon size={32} />
              </div>
              <h3 className="cva-title">Telegram Access</h3>
              <p className="cva-desc">Enter your phone number to connect</p>
            </div>

            {showTabs && (
              <div className="cva-tabs">
                <button
                  onClick={() => { setMode("auto"); resetForm(); }}
                  className={`cva-tab ${mode === "auto" ? "active" : ""}`}
                >
                  <Smartphone size={14} /> Login with Phone
                </button>
                <button
                  onClick={() => { setMode("manual"); resetForm(); }}
                  className={`cva-tab ${mode === "manual" ? "active" : ""}`}
                >
                  <Key size={14} /> Manual Session
                </button>
              </div>
            )}

            {saveSuccess && (
              <div style={{
                padding: "12px",
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid #10b981",
                borderRadius: "10px",
                marginBottom: "16px",
                textAlign: "center",
                color: "#10b981"
              }}>
                Session saved successfully!
              </div>
            )}

            {mode === "auto" && (
              <div className="cva-auto-container">
                {step === "phone" ? (
                  <>
                    <div className="cva-phone-input-wrapper">
                      <div className="cva-country-selector" ref={dropdownRef}>
                        <button
                          type="button"
                          className="cva-country-btn"
                          onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                        >
                          <span className="cva-country-flag">{selectedCountry.flag}</span>
                          <span className="cva-country-code">{selectedCountry.code}</span>
                          <ChevronDown size={16} className={`cva-country-chevron ${isCountryDropdownOpen ? 'open' : ''}`} />
                        </button>
                        {isCountryDropdownOpen && (
                          <div className="cva-country-dropdown">
                            <div className="cva-country-search">
                              <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search country..."
                                value={countrySearch}
                                onChange={(e) => setCountrySearch(e.target.value)}
                                className="cva-search-input"
                              />
                            </div>
                            <div className="cva-country-list">
                              {filteredCountries.length > 0 ? (
                                filteredCountries.map((country) => (
                                  <button
                                    key={country.code}
                                    className={`cva-country-option ${selectedCountry.code === country.code ? 'active' : ''}`}
                                    onClick={() => {
                                      setSelectedCountry(country);
                                      setIsCountryDropdownOpen(false);
                                      setCountrySearch("");
                                      setFilteredCountries(countryCodes);
                                    }}
                                  >
                                    <span className="cva-country-flag">{country.flag}</span>
                                    <span className="cva-country-name">{country.country}</span>
                                    <span className="cva-country-code-option">{country.code}</span>
                                  </button>
                                ))
                              ) : (
                                <div className="cva-country-no-result">No country found</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <input
                        type="tel"
                        placeholder="Input Phone"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="cva-phone-input"
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={handleSendCode}
                      disabled={isSendingCode}
                      className="cva-btn"
                    >
                      {isSendingCode ? "Sending..." : "Send Code"}
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Verification code (5-6 digits)"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="github-modal-input"
                      autoFocus
                    />
                    <button
                      onClick={handleVerifyCode}
                      disabled={isSaving || !code.trim() || code.length < 5}
                      className="cva-btn"
                    >
                      {isSaving ? "Verifying..." : "Verify & Connect"}
                    </button>
                    {error && (
                      <div className="cva-error">
                        <AlertCircle size={14} /> {error}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {mode === "manual" && (
              <div className="cva-manual-container">
                <div className="cva-input-wrap">
                  <input
                    type="text"
                    placeholder="Account name (optional)"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="github-modal-input cva-session-input"
                  />
                </div>
                <div className="cva-input-wrap">
                  <input
                    type={showSession ? "text" : "password"}
                    placeholder="Input Session"
                    value={sessionString}
                    onChange={(e) => setSessionString(e.target.value)}
                    className="github-modal-input cva-session-input"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowSession(!showSession)}
                    className="cva-eye-btn"
                    aria-label={showSession ? "Hide session" : "Show session"}
                  >
                    {showSession ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <button
                  onClick={handleManualSave}
                  disabled={isSaving || isValidating || !sessionString.trim()}
                  className="cva-btn"
                >
                  {isValidating ? "Validating..." : isSaving ? "Saving..." : "Save Session"}
                </button>
              </div>
            )}

            {error && mode === "auto" && step === "phone" && (
              <div className="cva-error">
                <AlertCircle size={14} /> {error}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};