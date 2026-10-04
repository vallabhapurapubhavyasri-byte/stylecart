const fallbackProducts = [
	{ id: 1, name: "Everyday Cotton Tee", description: "Soft organic cotton, cut for the long haul.", category: "Wear", price: 899, image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=700&q=80", tag: "A GOOD BASIC", stock: 24 },
	{ id: 2, name: "Studio Headphones", description: "Clear sound, quiet moments, all-day comfort.", category: "Tech", price: 2499, image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=80", tag: "A LITTLE ESCAPE", stock: 18 },
	{ id: 3, name: "Sunday Runners", description: "Light on your feet from here to everywhere.", category: "Wear", price: 3299, image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=700&q=80", tag: "MADE TO MOVE", stock: 12 },
	{ id: 4, name: "Everywhere Tote", description: "Room for the things that make a day yours.", category: "Carry", price: 1199, image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=700&q=80", tag: "TAKE IT ALONG", stock: 30 },
	{ id: 5, name: "Sunday Ceramic Mug", description: "A slow morning, held in both hands.", category: "Home", price: 649, image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=700&q=80", tag: "SLOW MORNING", stock: 20 },
	{ id: 6, name: "Daily Carry Pack", description: "A considered place for everything you need.", category: "Carry", price: 1899, image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=80", tag: "ON YOUR SIDE", stock: 15 },
	{ id: 7, name: "Desk Light No. 2", description: "A warm little pool of light for late ideas.", category: "Home", price: 2199, image: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=700&q=80", tag: "A BRIGHT IDEA", stock: 9 },
	{ id: 8, name: "Field Notes Watch", description: "A simple, reliable companion for every hour.", category: "Wear", price: 2799, image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=700&q=80", tag: "TIME WELL SPENT", stock: 11 }
];

const storageKeys = { cart: "stylecart.cart", token: "stylecart.token", user: "stylecart.user" };
const state = {
	products: fallbackProducts,
	category: "All",
	query: "",
	cart: readStorage(storageKeys.cart, []),
	token: localStorage.getItem(storageKeys.token),
	user: readStorage(storageKeys.user, null),
	authMode: "login",
	checkoutAfterAuth: false,
	apiAvailable: false
};

const productGrid = document.querySelector("#productGrid");
const cartDrawer = document.querySelector("#cartDrawer");
const scrim = document.querySelector("#scrim");
const productDialog = document.querySelector("#productDialog");
const authDialog = document.querySelector("#authDialog");
const checkoutDialog = document.querySelector("#checkoutDialog");
let toastTimer;

function readStorage(key, fallback) {
	try {
		const value = JSON.parse(localStorage.getItem(key));
		return value ?? fallback;
	} catch {
		return fallback;
	}
}

function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (character) => ({
		"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
	})[character]);
}

function money(amount) {
	return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

async function apiRequest(path, options = {}) {
	const headers = { "Content-Type": "application/json", ...options.headers };
	if (state.token) headers.Authorization = `Bearer ${state.token}`;
	let response;
	try {
		response = await fetch(`/api${path}`, { ...options, headers });
	} catch {
		throw new Error("The store server is offline. Start it with npm start to use this feature.");
	}
	const data = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
	return data;
}

function renderProducts() {
	const visibleProducts = state.products.filter((product) => {
		const matchesCategory = state.category === "All" || product.category === state.category;
		const searchable = `${product.name} ${product.description} ${product.category}`.toLowerCase();
		return matchesCategory && searchable.includes(state.query.toLowerCase());
	});

	document.querySelector("#resultCount").textContent = `${visibleProducts.length} ${visibleProducts.length === 1 ? "piece" : "pieces"}`;
	document.querySelector("#emptyState").hidden = visibleProducts.length > 0;
	productGrid.innerHTML = visibleProducts.map((product, index) => `
		<article class="product-card" style="animation-delay:${Math.min(index * 55, 220)}ms">
			<div class="product-art">
				<button class="product-view" data-view-product="${product.id}" aria-label="View ${escapeHtml(product.name)}">
					<img src="${escapeHtml(product.image)}" alt="" loading="lazy">
					<span class="product-tag">${escapeHtml(product.tag || product.category.toUpperCase())}</span>
				</button>
				<button class="quick-add" data-add-product="${product.id}">Add to bag <span aria-hidden="true">+</span></button>
			</div>
			<div class="product-meta"><h3>${escapeHtml(product.name)}</h3><span>${money(product.price)}</span></div>
			<p class="product-description">${escapeHtml(product.description)}</p>
		</article>`).join("");
}

function getCartItems() {
	return state.cart.map((entry) => ({
		...entry,
		product: state.products.find((product) => Number(product.id) === Number(entry.id))
	})).filter((entry) => entry.product && entry.quantity > 0);
}

function saveCart() {
	localStorage.setItem(storageKeys.cart, JSON.stringify(state.cart));
	renderCart();
}

function renderCart() {
	const items = getCartItems();
	const count = items.reduce((sum, item) => sum + item.quantity, 0);
	const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
	document.querySelector("#cartCount").textContent = count;
	document.querySelector("#drawerCount").textContent = `(${count})`;
	document.querySelector("#cartEmpty").hidden = items.length > 0;
	document.querySelector("#cartSummary").hidden = items.length === 0;
	document.querySelector("#cartSubtotal").textContent = money(subtotal);
	document.querySelector("#checkoutTotal").textContent = money(subtotal);
	document.querySelector("#cartItems").innerHTML = items.map(({ product, quantity }) => `
		<article class="cart-item">
			<img src="${escapeHtml(product.image)}" alt="">
			<div><h3>${escapeHtml(product.name)}</h3><p>${money(product.price)}</p>
				<div class="quantity-control" aria-label="Quantity for ${escapeHtml(product.name)}">
					<button data-quantity="${product.id}" data-change="-1" aria-label="Remove one">−</button>
					<span>${quantity}</span>
					<button data-quantity="${product.id}" data-change="1" aria-label="Add one">+</button>
				</div>
			</div>
			<button class="remove-item" data-remove-item="${product.id}" aria-label="Remove ${escapeHtml(product.name)}">×</button>
		</article>`).join("");
}

function addToCart(id) {
	const product = state.products.find((item) => Number(item.id) === Number(id));
	if (!product) return;
	if (product.stock < 1) {
		showToast("That piece is currently out of stock.");
		return;
	}
	const entry = state.cart.find((item) => Number(item.id) === Number(id));
	if (entry) entry.quantity = Math.min(entry.quantity + 1, product.stock);
	else state.cart.push({ id: product.id, quantity: 1 });
	saveCart();
	showToast(`${product.name} added to your bag.`);
}

function openCart() {
	cartDrawer.classList.add("open");
	cartDrawer.setAttribute("aria-hidden", "false");
	scrim.classList.add("visible");
	document.querySelector("#closeCart").focus();
}

function closeCart() {
	cartDrawer.classList.remove("open");
	cartDrawer.setAttribute("aria-hidden", "true");
	scrim.classList.remove("visible");
}

function openProduct(id) {
	const product = state.products.find((item) => Number(item.id) === Number(id));
	if (!product) return;
	document.querySelector("#productDetail").innerHTML = `
		<div class="product-detail">
			<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}">
			<div class="product-detail-copy">
				<p class="eyebrow">${escapeHtml(product.category.toUpperCase())} · ${escapeHtml(product.tag || "THE EVERYDAY EDIT")}</p>
				<h2 id="productTitle">${escapeHtml(product.name)}</h2>
				<p class="detail-price">${money(product.price)}</p>
				<p class="detail-description">${escapeHtml(product.description)}</p>
				<button class="primary-button" data-add-product="${product.id}">Add to bag <span aria-hidden="true">+</span></button>
			</div>
		</div>`;
	productDialog.showModal();
}

function setAuthMode(mode) {
	state.authMode = mode;
	const isRegister = mode === "register";
	document.querySelectorAll("[data-auth-mode]").forEach((button) => button.classList.toggle("active", button.dataset.authMode === mode));
	document.querySelector("#nameField").hidden = !isRegister;
	document.querySelector("#nameField input").required = isRegister;
	document.querySelector("#authTitle").textContent = isRegister ? "Make yourself at home." : "Welcome back.";
	document.querySelector("#authSubmitLabel").textContent = isRegister ? "Create account" : "Sign in";
	document.querySelector("#authError").textContent = "";
}

function showToast(message) {
	const toast = document.querySelector("#toast");
	toast.textContent = message;
	toast.classList.add("visible");
	window.clearTimeout(toastTimer);
	toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 3200);
}

document.querySelector("#categoryFilters").addEventListener("click", (event) => {
	const button = event.target.closest("[data-category]");
	if (!button) return;
	state.category = button.dataset.category;
	document.querySelectorAll(".filter-button").forEach((filter) => filter.classList.toggle("active", filter === button));
	renderProducts();
});

document.querySelector("#searchInput").addEventListener("input", (event) => {
	state.query = event.target.value.trim();
	renderProducts();
});

document.querySelectorAll("[data-category-link]").forEach((link) => link.addEventListener("click", () => {
	const category = link.dataset.categoryLink;
	state.category = category;
	document.querySelectorAll(".filter-button").forEach((button) => button.classList.toggle("active", button.dataset.category === category));
	renderProducts();
}));

productGrid.addEventListener("click", (event) => {
	const addButton = event.target.closest("[data-add-product]");
	if (addButton) {
		event.stopPropagation();
		addToCart(addButton.dataset.addProduct);
		return;
	}
	const art = event.target.closest("[data-view-product]");
	if (art) openProduct(art.dataset.viewProduct);
});

document.querySelector("#productDetail").addEventListener("click", (event) => {
	const button = event.target.closest("[data-add-product]");
	if (!button) return;
	addToCart(button.dataset.addProduct);
	productDialog.close();
});

document.querySelector("#cartItems").addEventListener("click", (event) => {
	const quantityButton = event.target.closest("[data-quantity]");
	const removeButton = event.target.closest("[data-remove-item]");
	if (quantityButton) {
		const id = Number(quantityButton.dataset.quantity);
		const item = state.cart.find((entry) => Number(entry.id) === id);
		const product = state.products.find((entry) => Number(entry.id) === id);
		if (!item) return;
		item.quantity += Number(quantityButton.dataset.change);
		if (item.quantity <= 0) state.cart = state.cart.filter((entry) => Number(entry.id) !== id);
		if (product && item.quantity > product.stock) item.quantity = product.stock;
		saveCart();
	}
	if (removeButton) {
		state.cart = state.cart.filter((entry) => Number(entry.id) !== Number(removeButton.dataset.removeItem));
		saveCart();
	}
});

document.querySelector("#openCart").addEventListener("click", openCart);
document.querySelector("#closeCart").addEventListener("click", closeCart);
document.querySelector("#keepShopping").addEventListener("click", closeCart);
scrim.addEventListener("click", closeCart);
document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));

document.querySelector("#accountButton").addEventListener("click", () => {
	if (state.user) {
		if (!window.confirm(`Signed in as ${state.user.name}. Sign out?`)) return;
		apiRequest("/auth/logout", { method: "POST" }).catch(() => {});
		state.token = null;
		state.user = null;
		localStorage.removeItem(storageKeys.token);
		localStorage.removeItem(storageKeys.user);
		updateAccountButton();
		showToast("You have signed out.");
		return;
	}
	setAuthMode("login");
	authDialog.showModal();
});

document.querySelectorAll("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => setAuthMode(button.dataset.authMode)));

document.querySelector("#authForm").addEventListener("submit", async (event) => {
	event.preventDefault();
	const form = event.currentTarget;
	const values = Object.fromEntries(new FormData(form));
	const error = document.querySelector("#authError");
	error.textContent = "";
	try {
		const result = await apiRequest(`/auth/${state.authMode}`, { method: "POST", body: JSON.stringify(values) });
		state.token = result.token;
		state.user = result.user;
		localStorage.setItem(storageKeys.token, state.token);
		localStorage.setItem(storageKeys.user, JSON.stringify(state.user));
		updateAccountButton();
		authDialog.close();
		form.reset();
		showToast(`Welcome${state.user.name ? `, ${state.user.name.split(" ")[0]}` : " back"}.`);
		if (state.checkoutAfterAuth) {
			state.checkoutAfterAuth = false;
			openCheckout();
		}
	} catch (requestError) {
		error.textContent = requestError.message;
	}
});

function updateAccountButton() {
	const button = document.querySelector("#accountButton");
	button.setAttribute("aria-label", state.user ? `Signed in as ${state.user.name}. Click to sign out` : "Sign in");
	button.title = state.user ? `Signed in as ${state.user.name}` : "Sign in";
}

function openCheckout() {
	closeCart();
	document.querySelector("#checkoutError").textContent = "";
	checkoutDialog.showModal();
}

document.querySelector("#checkoutButton").addEventListener("click", () => {
	if (!state.user || !state.token) {
		state.checkoutAfterAuth = true;
		setAuthMode("login");
		authDialog.showModal();
		return;
	}
	openCheckout();
});

document.querySelector("#checkoutForm").addEventListener("submit", async (event) => {
	event.preventDefault();
	const error = document.querySelector("#checkoutError");
	error.textContent = "";
	const formValues = Object.fromEntries(new FormData(event.currentTarget));
	const items = state.cart.map(({ id, quantity }) => ({ productId: id, quantity }));
	try {
		const order = await apiRequest("/orders", { method: "POST", body: JSON.stringify({ ...formValues, items }) });
		state.cart = [];
		saveCart();
		checkoutDialog.close();
		event.currentTarget.reset();
		showToast(`Order ${order.orderNumber} is confirmed. Thank you!`);
	} catch (requestError) {
		error.textContent = requestError.message;
	}
});

document.querySelector("#newsletterForm").addEventListener("submit", async (event) => {
	event.preventDefault();
	const email = document.querySelector("#newsletterEmail").value;
	try {
		await apiRequest("/newsletter", { method: "POST", body: JSON.stringify({ email }) });
		event.currentTarget.reset();
		showToast("You’re on the list. Look out for a little note from us.");
	} catch (requestError) {
		showToast(requestError.message);
	}
});

async function loadProducts() {
	try {
		const result = await apiRequest("/products");
		state.products = result.products;
		state.apiAvailable = true;
	} catch {
		state.apiAvailable = false;
		window.setTimeout(() => showToast("Preview mode: start the store server to use accounts and checkout."), 700);
	}
	renderProducts();
	renderCart();
}

updateAccountButton();
renderProducts();
renderCart();
loadProducts();