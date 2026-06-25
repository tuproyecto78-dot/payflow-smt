"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, Plus, Loader2, Power, Trash2, Pencil, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Product {
  id: string; name: string; description: string | null; price: number;
  currency: string; stock: number; imageUrl: string | null; sku: string | null;
  active: boolean; categoryId: string | null; createdAt: string;
}

export function CatalogView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: 0, currency: "USD", stock: 0, sku: "", imageUrl: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/products");
      if (!res.ok) { toast.error("Error al cargar productos"); return; }
      const data = await res.json();
      setProducts(data.products || []);
    } catch { toast.error("Error de red"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) { setForm((f) => ({ ...f, [key]: value })); }

  async function createProduct() {
    if (!form.name.trim()) { toast.error("El nombre es obligatorio"); return; }
    if (form.price <= 0) { toast.error("El precio debe ser mayor a 0"); return; }
    try {
      const res = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Error al crear producto"); return; }
      toast.success("Producto creado");
      setCreateOpen(false);
      setForm({ name: "", description: "", price: 0, currency: "USD", stock: 0, sku: "", imageUrl: "" });
      await load();
    } catch { toast.error("Error de red"); }
  }

  async function toggleActive(product: Product) {
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !product.active }) });
      if (!res.ok) { toast.error("Error al actualizar"); return; }
      toast.success(product.active ? "Desactivado" : "Activado");
      await load();
    } catch { toast.error("Error de red"); }
  }

  async function updateStock(product: Product, delta: number) {
    const newStock = Math.max(0, product.stock + delta);
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stock: newStock }) });
      if (!res.ok) { toast.error("Error al actualizar stock"); return; }
      await load();
    } catch { toast.error("Error de red"); }
  }

  async function deleteProduct(product: Product) {
    if (!confirm(`¿Eliminar "${product.name}"?`)) return;
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Error al eliminar"); return; }
      toast.success("Producto eliminado");
      await load();
    } catch { toast.error("Error de red"); }
  }

  function openEdit(product: Product) {
    setEditProduct(product);
    setForm({ name: product.name, description: product.description || "", price: product.price, currency: product.currency, stock: product.stock, sku: product.sku || "", imageUrl: product.imageUrl || "" });
  }

  async function saveEdit() {
    if (!editProduct) return;
    try {
      const res = await fetch(`/api/products/${editProduct.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, description: form.description, price: form.price, stock: form.stock, sku: form.sku, imageUrl: form.imageUrl }) });
      if (!res.ok) { toast.error("Error al actualizar"); return; }
      toast.success("Producto actualizado");
      setEditProduct(null);
      await load();
    } catch { toast.error("Error de red"); }
  }

  const activeCount = products.filter((p) => p.active).length;
  const outOfStock = products.filter((p) => p.stock === 0 && p.active).length;

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="p-5 border-b border-border shrink-0">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><Package className="size-5 text-amber-500" />Catálogo</h1>
            <p className="text-sm text-muted-foreground mt-1">Gestiona productos, precios y stock para el Agente Comercial IA.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="bg-amber-500 hover:bg-amber-600 text-white"><Plus className="size-4 mr-2" />Crear producto</Button>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="rounded-lg border border-border bg-card p-3"><div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Total</div><div className="text-2xl font-bold">{products.length}</div></div>
          <div className="rounded-lg border border-border bg-card p-3"><div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Activos</div><div className="text-2xl font-bold text-emerald-600">{activeCount}</div></div>
          <div className="rounded-lg border border-border bg-card p-3"><div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Sin stock</div><div className="text-2xl font-bold text-red-600">{outOfStock}</div></div>
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-3 max-w-4xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="size-5 animate-spin mr-2" />Cargando…</div>
          ) : products.length === 0 ? (
            <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center text-center py-16"><Package className="size-10 mb-3 opacity-40 text-muted-foreground" /><p className="text-sm font-medium text-muted-foreground">No hay productos en el catálogo</p><Button onClick={() => setCreateOpen(true)} className="mt-4 bg-amber-500 hover:bg-amber-600 text-white"><Plus className="size-4 mr-2" />Crear producto</Button></CardContent></Card>
          ) : (
            products.map((product) => (
              <Card key={product.id} className={cn("overflow-hidden", !product.active && "opacity-60")}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1"><Package className="size-4 text-amber-500 shrink-0" /><span className="font-medium text-sm truncate">{product.name}</span>{product.sku && <Badge variant="outline" className="text-[9px] font-mono">{product.sku}</Badge>}</div>
                      {product.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{product.description}</p>}
                      <div className="flex flex-wrap gap-2">
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 text-[10px]">${product.price.toFixed(2)} {product.currency}</Badge>
                        <Badge className={cn("text-[10px]", product.stock > 0 ? "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400" : "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400")}>Stock: {product.stock}</Badge>
                        <Badge className={cn("text-[10px]", product.active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400")}>{product.active ? "Activo" : "Inactivo"}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => updateStock(product, -1)} disabled={product.stock === 0}>−</Button>
                      <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => updateStock(product, 1)}>+</Button>
                      <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => toggleActive(product)}><Power className="size-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => openEdit(product)}><Pencil className="size-3.5" /></Button>
                      <Button size="sm" variant="ghost" className="size-8 p-0 text-destructive" onClick={() => deleteProduct(product)}><Trash2 className="size-3.5" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto pf-scroll">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Package className="size-5 text-amber-500" />Crear producto</DialogTitle></DialogHeader>
          <ProductForm form={form} set={set} />
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button onClick={createProduct} className="bg-amber-500 hover:bg-amber-600 text-white"><Plus className="size-4 mr-2" />Crear</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!editProduct} onOpenChange={(o) => !o && setEditProduct(null)}>
        <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto pf-scroll">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="size-5 text-amber-500" />Editar producto</DialogTitle></DialogHeader>
          <ProductForm form={form} set={set} />
          <DialogFooter><Button variant="outline" onClick={() => setEditProduct(null)}>Cancelar</Button><Button onClick={saveEdit} className="bg-amber-500 hover:bg-amber-600 text-white">Guardar cambios</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductForm({ form, set }: { form: { name: string; description: string; price: number; currency: string; stock: number; sku: string; imageUrl: string }; set: <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => void }) {
  return (
    <div className="space-y-3 py-2">
      <div className="space-y-1.5"><Label className="text-xs">Nombre *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Laptop HP 15" className="h-9 text-sm" /></div>
      <div className="space-y-1.5"><Label className="text-xs">Descripción</Label><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Laptop 15 pulgadas, 8GB RAM, 256GB SSD" rows={2} className="text-sm" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label className="text-xs">Precio (USD) *</Label><Input type="number" value={form.price} onChange={(e) => set("price", Number(e.target.value))} placeholder="599.99" className="h-9 text-sm" /></div>
        <div className="space-y-1.5"><Label className="text-xs">Stock inicial</Label><Input type="number" value={form.stock} onChange={(e) => set("stock", Number(e.target.value))} placeholder="10" className="h-9 text-sm" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label className="text-xs">SKU (opcional)</Label><Input value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="LAP-HP-15" className="h-9 text-sm font-mono" /></div>
        <div className="space-y-1.5"><Label className="text-xs">Imagen URL (opcional)</Label><Input value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://..." className="h-9 text-sm" /></div>
      </div>
      <div className="rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400"><AlertCircle className="size-3 inline mr-1" />La IA no puede inventar precios. Solo usará los productos activos del catálogo.</div>
    </div>
  );
}
