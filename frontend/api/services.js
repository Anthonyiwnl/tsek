// Illustrative fixtures, not official barangay requirements or database records.
export const services = [
  {
    id: "clearance",
    name: "Barangay Clearance",
    description: "Prepare for a general clearance request.",
    requirements: [
      { id: "clearance-id", name: "Valid government-issued ID" },
      { id: "clearance-residency", name: "Proof of residency" },
    ],
  },
  {
    id: "residency",
    name: "Certificate of Residency",
    description: "Organize your proof of residence.",
    requirements: [
      { id: "residency-id", name: "Valid government-issued ID" },
      { id: "residency-address", name: "Proof of address" },
    ],
  },
  {
    id: "indigency",
    name: "Certificate of Indigency",
    description: "Get ready for an assistance application.",
    requirements: [
      { id: "indigency-id", name: "Valid government-issued ID" },
      { id: "indigency-residency", name: "Proof of residency" },
      {
        id: "indigency-purpose",
        name: "Supporting request or referral letter",
      },
    ],
  },
];
/** Serve read-only sample services, including empty and error scenarios; reject non-GET requests. */
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const scenario = new URL(req.url, "http://localhost").searchParams.get(
    "scenario",
  );
  if (scenario === "error")
    return res.status(503).json({ error: "Simulated service unavailable" });
  return res
    .status(200)
    .json({ source: "sample", services: scenario === "empty" ? [] : services });
}
