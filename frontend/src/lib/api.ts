const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://docflow-backend.onrender.com";

export async function fetchUserProfile(firebaseUid: string) {
  const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
    headers: {
      "X-Firebase-UID": firebaseUid,
    },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch user profile.");
  }
  return res.json();
}

export async function fetchUserHistory(firebaseUid: string) {
  const res = await fetch(`${API_BASE_URL}/api/user/history`, {
    headers: {
      "X-Firebase-UID": firebaseUid,
    },
  });
  if (!res.ok) {
    throw new Error("Failed to fetch conversion history.");
  }
  return res.json();
}

export async function syncUserWithBackend(firebaseUid: string, email?: string | null, displayName?: string | null) {
  const res = await fetch(`${API_BASE_URL}/api/auth/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      firebase_uid: firebaseUid,
      email: email || null,
      display_name: displayName || null,
    }),
  });
  if (!res.ok) {
    throw new Error("Failed to sync user with backend.");
  }
  return res.json();
}

export async function fetchPdfThumbnails(file: File) {
  try {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE_URL}/api/tools/pdf-thumbnails`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      return { success: false, thumbnails: [] };
    }
    return res.json();
  } catch (e) {
    console.warn("fetchPdfThumbnails network warning:", e);
    return { success: false, thumbnails: [] };
  }
}

export async function processToolApi(endpoint: string, formData: FormData, firebaseUid?: string) {
  const headers: Record<string, string> = {};
  if (firebaseUid) {
    headers["X-Firebase-UID"] = firebaseUid;
  }

  const res = await fetch(`${API_BASE_URL}/api/tools/${endpoint}`, {
    method: "POST",
    headers,
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    const errorMsg = typeof data.detail === "string" ? data.detail : "Unable to process this file.";
    throw new Error(errorMsg);
  }
  return data;
}

export async function searchPdfMatches(file: File, searchText: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("search_text", searchText);

  try {
    const res = await fetch(`${API_BASE_URL}/api/tools/search-pdf-matches`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) return { success: false, matches: [] };
    const data = await res.json();
    return data;
  } catch {
    return { success: false, matches: [] };
  }
}

export async function createRazorpayOrder(plan: string, firebaseUid: string) {
  const res = await fetch(`${API_BASE_URL}/api/payment/create-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Firebase-UID": firebaseUid,
    },
    body: JSON.stringify({ plan }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Unable to create payment order.");
  }
  return data;
}

export async function verifyRazorpayPayment(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  plan: string;
}, firebaseUid: string) {
  const res = await fetch(`${API_BASE_URL}/api/payment/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Firebase-UID": firebaseUid,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Payment verification failed.");
  }
  return data;
}

export async function sendContactMessage(payload: { name: string; email: string; subject: string; message: string }) {
  const res = await fetch(`${API_BASE_URL}/api/contact`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    const errorMsg = typeof data.detail === "string" ? data.detail : "Unable to send your message.";
    throw new Error(errorMsg);
  }
  return data;
}

export function getDownloadUrl(downloadKey: string) {
  return `${API_BASE_URL}/api/tools/download/${downloadKey}`;
}
