import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import { MongoClient, ObjectId } from "mongodb";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });
const frontendDirectory = path.resolve(__dirname, "frontend");
const configuredMongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const mongoUri = /^(mongodb|mongodb\+srv):\/\//.test(configuredMongoUri)
    ? configuredMongoUri
    : "mongodb://127.0.0.1:27017";
if (mongoUri !== configuredMongoUri) console.error("Invalid MONGODB_URI. Using the local MongoDB address for preview mode.");
const mongoClient = new MongoClient(mongoUri);
const database = mongoClient.db(process.env.MONGODB_DB || "stylecart");
const products = database.collection("products");
const users = database.collection("users");
const sessions = database.collection("sessions");
const orders = database.collection("orders");
const newsletterSubscribers = database.collection("newsletter_subscribers");

const seedProducts = [
    { _id: 1, name: "Everyday Cotton Tee", description: "Soft organic cotton, cut for the long haul.", category: "Wear", price: 899, image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=80", tag: "A GOOD BASIC", stock: 24 },
    { _id: 2, name: "Studio Headphones", description: "Clear sound, quiet moments, all-day comfort.", category: "Tech", price: 2499, image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=80", tag: "A LITTLE ESCAPE", stock: 18 },
    { _id: 3, name: "Sunday Runners", description: "Light on your feet from here to everywhere.", category: "Wear", price: 3299, image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=80", tag: "MADE TO MOVE", stock: 12 },
    { _id: 4, name: "Everywhere Tote", description: "Room for the things that make a day yours.", category: "Carry", price: 1199, image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=700&q=80", tag: "TAKE IT ALONG", stock: 30 },
    { _id: 5, name: "Sunday Ceramic Mug", description: "A slow morning, held in both hands.", category: "Home", price: 649, image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=700&q=80", tag: "SLOW MORNING", stock: 20 },
    { _id: 6, name: "Daily Carry Pack", description: "A considered place for everything you need.", category: "Carry", price: 1899, image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=80", tag: "ON YOUR SIDE", stock: 15 },
    { _id: 7, name: "Desk Light No. 2", description: "A warm little pool of light for late ideas.", category: "Home", price: 2199, image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=700&q=80", tag: "A BRIGHT IDEA", stock: 9 },
    { _id: 8, name: "Field Notes Watch", description: "A simple, reliable companion for every hour.", category: "Wear", price: 2799, image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=80", tag: "TIME WELL SPENT", stock: 11 }
];

async function initializeDatabase() {
    await Promise.all([
        users.createIndex({ email: 1 }, { unique: true }),
        sessions.createIndex({ token_hash: 1 }, { unique: true }),
        sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        orders.createIndex({ orderNumber: 1 }, { unique: true }),
        newsletterSubscribers.createIndex({ email: 1 }, { unique: true })
    ]);
    await products.bulkWrite(seedProducts.map((product) => ({
        updateOne: { filter: { _id: product._id }, update: { $setOnInsert: product }, upsert: true }
    })), { ordered: false });
}

const app = express();
app.disable("x-powered-by");
app.use((request, response, next) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
});
app.use(express.json({ limit: "20kb" }));
app.use("/api", (request, response, next) => {
    if (request.method !== "POST") return next();
    if (!request.is("application/json") || !request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
        return response.status(400).json({ error: "Send a JSON object to this endpoint." });
    }
    next();
});

const publicFiles = {
    "/": "websit.html",
    "/websit.html": "websit.html",
    "/style.css": "style.css",
    "/scipt.js": "scipt.js"
};
for (const [route, filename] of Object.entries(publicFiles)) {
    app.get(route, (_request, response) => response.sendFile(path.join(frontendDirectory, filename)));
}

app.get("/api/products", async (_request, response) => {
    const productList = await products.find({}, { projection: { _id: 1, name: 1, description: 1, category: 1, price: 1, image: 1, tag: 1, stock: 1 } }).sort({ _id: 1 }).toArray();
    response.json({ products: productList.map(toPublicProduct) });
});

app.get("/api/products/:id", async (request, response) => {
    const productId = Number(request.params.id);
    if (!Number.isSafeInteger(productId) || productId < 1) return response.status(404).json({ error: "Product not found." });
    const product = await products.findOne({ _id: productId });
    if (!product) return response.status(404).json({ error: "Product not found." });
    response.json({ product: toPublicProduct(product) });
});

function toPublicProduct(product) {
    return {
        id: product._id,
        name: product.name,
        description: product.description,
        category: product.category,
        price: product.price,
        image: product.image,
        tag: product.tag,
        stock: product.stock
    };
}

function hashToken(token) {
    return createHash("sha256").update(token).digest("hex");
}

async function createSession(userId) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await sessions.insertOne({ token_hash: hashToken(token), user_id: userId, expiresAt });
    return token;
}

async function authRequired(request, response, next) {
    const match = /^Bearer ([a-f\d]{64})$/i.exec(request.get("authorization") || "");
    if (!match) return response.status(401).json({ error: "Please sign in to continue." });
    const session = await sessions.findOne({ token_hash: hashToken(match[1]), expiresAt: { $gt: new Date() } });
    if (!session) return response.status(401).json({ error: "Your session has expired. Please sign in again." });
    const user = await users.findOne({ _id: session.user_id }, { projection: { name: 1, email: 1 } });
    if (!user) return response.status(401).json({ error: "Your session has expired. Please sign in again." });
    request.user = { id: user._id.toString(), name: user.name, email: user.email };
    next();
}

function validEmail(email) {
    return typeof email === "string" && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.post("/api/auth/register", async (request, response, next) => {
    const name = typeof request.body.name === "string" ? request.body.name.trim() : "";
    const email = typeof request.body.email === "string" ? request.body.email.trim().toLowerCase() : "";
    const password = typeof request.body.password === "string" ? request.body.password : "";
    if (name.length < 2 || name.length > 80) return response.status(400).json({ error: "Enter a name between 2 and 80 characters." });
    if (!validEmail(email)) return response.status(400).json({ error: "Enter a valid email address." });
    if (password.length < 8 || password.length > 128) return response.status(400).json({ error: "Use a password between 8 and 128 characters." });

    try {
        const salt = randomBytes(16).toString("hex");
        const passwordHash = scryptSync(password, salt, 64).toString("hex");
        const result = await users.insertOne({ name, email, password_hash: passwordHash, password_salt: salt, createdAt: new Date() });
        const user = { id: result.insertedId.toString(), name, email };
        response.status(201).json({ user, token: await createSession(result.insertedId) });
    } catch (error) {
        if (error.code === 11000) return response.status(409).json({ error: "An account with this email already exists." });
        next(error);
    }
});

app.post("/api/auth/login", async (request, response) => {
    const email = typeof request.body.email === "string" ? request.body.email.trim().toLowerCase() : "";
    const password = typeof request.body.password === "string" ? request.body.password : "";
    const account = await users.findOne({ email });
    if (!account || password.length > 128) return response.status(401).json({ error: "Email or password is incorrect." });

    const passwordHash = scryptSync(password, account.password_salt, 64);
    const savedHash = Buffer.from(account.password_hash, "hex");
    if (savedHash.length !== passwordHash.length || !timingSafeEqual(savedHash, passwordHash)) {
        return response.status(401).json({ error: "Email or password is incorrect." });
    }

    const user = { id: account._id.toString(), name: account.name, email: account.email };
    response.json({ user, token: await createSession(account._id) });
});

app.post("/api/auth/logout", async (request, response) => {
    const match = /^Bearer ([a-f\d]{64})$/i.exec(request.get("authorization") || "");
    if (match) await sessions.deleteOne({ token_hash: hashToken(match[1]) });
    response.json({ ok: true });
});

app.post("/api/orders", authRequired, async (request, response, next) => {
    const name = typeof request.body.name === "string" ? request.body.name.trim() : "";
    const phone = typeof request.body.phone === "string" ? request.body.phone.trim() : "";
    const address = typeof request.body.address === "string" ? request.body.address.trim() : "";
    const requestedItems = request.body.items;
    if (name.length < 2 || name.length > 100) return response.status(400).json({ error: "Enter a valid full name." });
    if (!/^[+\d()\-\s]{10,20}$/.test(phone)) return response.status(400).json({ error: "Enter a valid phone number." });
    if (address.length < 8 || address.length > 500) return response.status(400).json({ error: "Enter a delivery address between 8 and 500 characters." });
    if (!Array.isArray(requestedItems) || requestedItems.length < 1 || requestedItems.length > 30) {
        return response.status(400).json({ error: "Your bag is empty or contains too many items." });
    }

    const uniqueItems = new Set();
    for (const item of requestedItems) {
        if (!item || typeof item !== "object" || !Number.isInteger(item.productId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99 || uniqueItems.has(item.productId)) {
            return response.status(400).json({ error: "Your bag contains an invalid item. Please review it and try again." });
        }
        uniqueItems.add(item.productId);
    }

    const productDocuments = await products.find({ _id: { $in: requestedItems.map((item) => item.productId) } }).toArray();
    const productById = new Map(productDocuments.map((product) => [product._id, product]));
    const lineItems = [];
    for (const item of requestedItems) {
        const product = productById.get(item.productId);
        if (!product) return response.status(400).json({ error: "A product in your bag is no longer available." });
        if (product.stock < item.quantity) return response.status(409).json({ error: `${product.name} has only ${product.stock} left in stock.` });
        lineItems.push({ productId: product._id, productName: product.name, unitPrice: product.price, quantity: item.quantity });
    }

    const reservations = [];
    try {
        for (const item of lineItems) {
            const result = await products.updateOne(
                { _id: item.productId, stock: { $gte: item.quantity } },
                { $inc: { stock: -item.quantity } }
            );
            if (result.modifiedCount !== 1) {
                const currentProduct = await products.findOne({ _id: item.productId });
                throw Object.assign(new Error(`${item.productName} has only ${currentProduct?.stock ?? 0} left in stock.`), { status: 409 });
            }
            reservations.push(item);
        }

        const total = lineItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        const orderNumber = `SC-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
        await orders.insertOne({
            orderNumber,
            user_id: new ObjectId(request.user.id),
            customer_name: name,
            phone,
            address,
            items: lineItems,
            total,
            createdAt: new Date()
        });
        response.status(201).json({ orderNumber, total });
    } catch (error) {
        await restoreStock(reservations).catch((restoreError) => console.error("Unable to restore reserved stock:", restoreError));
        if (error.status) return response.status(error.status).json({ error: error.message });
        next(error);
    }
});

async function restoreStock(reservations) {
    for (const item of reservations) {
        await products.updateOne({ _id: item.productId }, { $inc: { stock: item.quantity } });
    }
}

app.post("/api/newsletter", async (request, response) => {
    const email = typeof request.body.email === "string" ? request.body.email.trim().toLowerCase() : "";
    if (!validEmail(email)) return response.status(400).json({ error: "Enter a valid email address." });
    await newsletterSubscribers.updateOne({ email }, { $setOnInsert: { email, createdAt: new Date() } }, { upsert: true });
    response.status(201).json({ ok: true });
});

app.use((error, _request, response, _next) => {
    console.error(error);
    if (error.status === 400) return response.status(400).json({ error: "Request body must contain valid JSON." });
    if (error.status === 413) return response.status(413).json({ error: "Request body is too large." });
    response.status(500).json({ error: "The store hit a problem. Please try again." });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`StyleCart is running at http://localhost:${port}`));
try {
    await mongoClient.connect();
    await initializeDatabase();
} catch (error) {
    console.error("Unable to connect to MongoDB. The storefront is available in preview mode; configure MONGODB_URI for accounts and checkout.", error.message);
}
