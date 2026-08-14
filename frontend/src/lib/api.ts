const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
