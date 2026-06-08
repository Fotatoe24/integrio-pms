"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Property {
  id: string;
  name: string;
  address: string;
  description: string | null;
  airbnbIcalUrl: string | null;
  ourIcalToken: string;
  createdAt: string;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

   useEffect(() => {
     document.title = "Properties";
   }, []);

  const [form, setForm] = useState({
    name: "",
    address: "",
    description: "",
    airbnbIcalUrl: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadProperties();
  }, []);

  async function loadProperties() {
    setLoading(true);
    const { data, error } = await supabase
      .from("Property")
      .select("*")
      .order("createdAt", { ascending: false });
    if (!error && data) setProperties(data);
    setLoading(false);
  }

  function openAdd() {
    setForm({ name: "", address: "", description: "", airbnbIcalUrl: "" });
    setEditingId(null);
    setError("");
    setShowForm(true);
  }

  function openEdit(p: Property) {
    setForm({
      name: p.name,
      address: p.address,
      description: p.description || "",
      airbnbIcalUrl: p.airbnbIcalUrl || "",
    });
    setEditingId(p.id);
    setError("");
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    if (editingId) {
      const { error } = await supabase
        .from("Property")
        .update({
          name: form.name,
          address: form.address,
          description: form.description || null,
          airbnbIcalUrl: form.airbnbIcalUrl || null,
        })
        .eq("id", editingId);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("Property").insert({
        name: form.name,
        address: form.address,
        description: form.description || null,
        airbnbIcalUrl: form.airbnbIcalUrl || null,
      });
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setShowForm(false);
    loadProperties();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this property? This cannot be undone.")) return;
    setDeleting(id);
    await supabase.from("Property").delete().eq("id", id);
    setDeleting(null);
    loadProperties();
  }

  function copyIcalLink(token: string, id: string) {
    const url = `${window.location.origin}/api/ical/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: "#1a2744",
              marginBottom: 4,
            }}
          >
            Properties
          </h1>
          <p style={{ color: "#8896a5", fontSize: 14 }}>
            {properties.length} propert{properties.length !== 1 ? "ies" : "y"}{" "}
            registered
          </p>
        </div>
        <button
          onClick={openAdd}
          style={{
            background: "linear-gradient(135deg, #1a2744, #2cb5b0)",
            color: "white",
            border: "none",
            borderRadius: 10,
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 4px 16px rgba(44,181,176,0.3)",
          }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add Property
        </button>
      </div>

      {/* Property Cards */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#8896a5" }}>
          Loading properties...
        </div>
      ) : properties.length === 0 ? (
        <div
          style={{
            background: "white",
            borderRadius: 16,
            padding: 60,
            textAlign: "center",
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏠</div>
          <h3 style={{ color: "#1a2744", marginBottom: 8 }}>
            No properties yet
          </h3>
          <p style={{ color: "#8896a5", fontSize: 14, marginBottom: 24 }}>
            Add your first property to get started
          </p>
          <button
            onClick={openAdd}
            style={{
              background: "linear-gradient(135deg, #1a2744, #2cb5b0)",
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Add Property
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 20,
          }}
        >
          {properties.map((p) => (
            <div
              key={p.id}
              style={{
                background: "white",
                borderRadius: 16,
                boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
                overflow: "hidden",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
            >
              {/* Card header */}
              <div
                style={{
                  background: "linear-gradient(135deg, #1a2744, #243660)",
                  padding: "20px 24px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.5)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        marginBottom: 4,
                      }}
                    >
                      Property
                    </div>
                    <h3
                      style={{
                        color: "white",
                        fontSize: 18,
                        fontWeight: 700,
                        marginBottom: 4,
                      }}
                    >
                      {p.name}
                    </h3>
                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
                      📍 {p.address}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => openEdit(p)}
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        border: "none",
                        borderRadius: 8,
                        width: 32,
                        height: 32,
                        cursor: "pointer",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deleting === p.id}
                      style={{
                        background: "rgba(231,76,60,0.2)",
                        border: "none",
                        borderRadius: 8,
                        width: 32,
                        height: 32,
                        cursor: "pointer",
                        color: "#e74c3c",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Card body */}
              <div
                style={{
                  padding: "20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                {p.description && (
                  <p
                    style={{ fontSize: 13, color: "#8896a5", lineHeight: 1.5 }}
                  >
                    {p.description}
                  </p>
                )}

                {/* Airbnb iCal */}
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#8896a5",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 6,
                      fontWeight: 600,
                    }}
                  >
                    Airbnb iCal URL
                  </div>
                  {p.airbnbIcalUrl ? (
                    <div
                      style={{
                        background: "#f0f4f8",
                        borderRadius: 8,
                        padding: "8px 12px",
                        fontSize: 12,
                        color: "#1a2744",
                        wordBreak: "break-all",
                        fontFamily: "monospace",
                      }}
                    >
                      {p.airbnbIcalUrl}
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#c0c9d4",
                        fontStyle: "italic",
                      }}
                    >
                      Not set
                    </div>
                  )}
                </div>

                {/* Our iCal link */}
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#8896a5",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 6,
                      fontWeight: 600,
                    }}
                  >
                    Your iCal Link (share with Airbnb)
                  </div>
                  <div
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <div
                      style={{
                        background: "#f0f4f8",
                        borderRadius: 8,
                        padding: "8px 12px",
                        fontSize: 12,
                        color: "#1a2744",
                        fontFamily: "monospace",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      /api/ical/{p.ourIcalToken}
                    </div>
                    <button
                      onClick={() => copyIcalLink(p.ourIcalToken, p.id)}
                      style={{
                        background: copiedId === p.id ? "#27ae60" : "#1a2744",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        padding: "8px 14px",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "background 0.2s",
                      }}
                    >
                      {copiedId === p.id ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 24,
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 20,
              padding: 36,
              width: "100%",
              maxWidth: 520,
              boxShadow: "0 32px 80px rgba(0,0,0,0.3)",
              animation: "cardIn 0.3s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 28,
              }}
            >
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a2744" }}>
                {editingId ? "Edit Property" : "Add Property"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                style={{
                  background: "#f0f4f8",
                  border: "none",
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  cursor: "pointer",
                  fontSize: 18,
                  color: "#8896a5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSave}
              style={{ display: "flex", flexDirection: "column", gap: 18 }}
            >
              {[
                {
                  label: "Property Name *",
                  key: "name",
                  placeholder: "e.g. Beachfront Villa",
                  required: true,
                },
                {
                  label: "Address *",
                  key: "address",
                  placeholder: "e.g. 123 Beach Rd, Batangas",
                  required: true,
                },
                {
                  label: "Description",
                  key: "description",
                  placeholder: "Optional description...",
                },
                {
                  label: "Airbnb iCal URL",
                  key: "airbnbIcalUrl",
                  placeholder: "https://www.airbnb.com/calendar/ical/...",
                },
              ].map((field) => (
                <div key={field.key}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#8896a5",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 8,
                    }}
                  >
                    {field.label}
                  </label>
                  <input
                    type="text"
                    value={form[field.key as keyof typeof form]}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [field.key]: e.target.value }))
                    }
                    placeholder={field.placeholder}
                    required={field.required}
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      border: "1.5px solid #e8edf3",
                      borderRadius: 10,
                      fontSize: 14,
                      color: "#1a2744",
                      outline: "none",
                      transition: "border-color 0.2s",
                      fontFamily: "-apple-system, sans-serif",
                    }}
                  />
                </div>
              ))}

              {error && (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 13,
                    color: "#e74c3c",
                  }}
                >
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{
                    flex: 1,
                    padding: "12px",
                    border: "1.5px solid #e8edf3",
                    borderRadius: 10,
                    background: "white",
                    color: "#8896a5",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    flex: 2,
                    padding: "12px",
                    background: "linear-gradient(135deg, #1a2744, #2cb5b0)",
                    border: "none",
                    borderRadius: 10,
                    color: "white",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Save Changes"
                    : "Add Property"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes cardIn {
          from { opacity: 0; transform: scale(0.96) translateY(16px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
