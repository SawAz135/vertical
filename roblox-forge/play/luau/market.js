/* =====================================================================
   Roblox Forge · Jouer — purchases, like a test purchase in Roblox Studio.
   PromptProductPurchase / PromptGamePassPurchase / PromptPurchase /
   PromptBundlePurchase / PromptSubscriptionPurchase open the game's
   purchase dialog (engine.onPurchase, drawn by the live game: real name,
   price and icon). Buying spends no Robux:
   - developer products call MarketplaceService.ProcessReceipt (retried
     until it answers PurchaseGranted, like Roblox) and fire
     PromptProductPurchaseFinished;
   - game passes become owned (remembered on this device, per game):
     UserOwnsGamePassAsync answers true, PromptGamePassPurchaseFinished fires;
   - assets: PlayerOwnsAsset, PromptPurchaseFinished.
   GetProductInfo answers with the real name / price when Roblox shares it.
   ===================================================================== */
import { Instance, enumItem } from './roblox.js?v=12';
import { LuaTable, call } from './luau.js?v=12';
import { RELAY } from '../assets.js?v=12';

const fn = (f) => f;
const LS = (() => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; } })();
export class Market {
  constructor(engine) { this.E = engine; this.rt = engine.rt; this.info = new Map(); this.install(); }
  key(kind) { return `forgeplay.owned.${this.rt.placeKey || 'place'}.${kind}`; }
  owned(kind) { try { return new Set(JSON.parse((LS && LS.getItem(this.key(kind))) || '[]')); } catch { return new Set(); } }
  own(kind, id) { const s = this.owned(kind); s.add(Number(id)); try { LS && LS.setItem(this.key(kind), JSON.stringify([...s])); } catch {} this.mem = this.mem || {}; (this.mem[kind] ||= new Set()).add(Number(id)); }
  has(kind, id) { return this.owned(kind).has(Number(id)) || !!(this.mem && this.mem[kind] && this.mem[kind].has(Number(id))); }
  /* name / price / icon (cached), from the relay; generic when Roblox does not share it */
  async details(kind, id) { const k = kind + id; if (this.info.has(k)) return this.info.get(k);
    let d = null; if (kind !== 'product' && typeof fetch !== 'undefined') { try { const r = await fetch(`${RELAY}?id=${id}&k=info&t=${kind === 'pass' ? 'pass' : 'asset'}`); if (r.ok) d = await r.json(); } catch { /* offline */ } }
    d = { Name: (d && d.Name) || (kind === 'pass' ? 'Game Pass' : kind === 'product' ? 'Produit' : 'Article'), PriceInRobux: d && d.PriceInRobux != null ? d.PriceInRobux : null, IconImageAssetId: (d && d.IconImageAssetId) || 0, Description: (d && d.Description) || '' };
    this.info.set(k, d); return d; }
  fire(name, args) { const s = this.rt.service('MarketplaceService').sigs.get(name); if (!s) return; const I = this.E.I, prev = I.side; I.side = 'server'; try { s.fire(args); } finally { I.side = prev; } }
  async prompt(kind, player, id) {
    id = Number(id); if (this.busy) return; this.busy = true; const d = await this.details(kind, id);
    let bought = false; try { bought = this.E.onPurchase ? await this.E.onPurchase({ kind, id, ...d, owned: kind === 'pass' && this.has('pass', id) }) : true; } finally { this.busy = false; }
    const P = player || this.E.player, uid = P ? P.props.get('UserId') : 1;
    if (kind === 'product') { this.fire('PromptProductPurchaseFinished', [uid, id, bought]); if (bought) this.receipt(uid, id, d.PriceInRobux || 0); }
    else if (kind === 'pass') { if (bought) this.own('pass', id); this.fire('PromptGamePassPurchaseFinished', [P, id, bought]); }
    else { if (bought) this.own('asset', id); this.fire(kind === 'bundle' ? 'PromptBundlePurchaseFinished' : 'PromptPurchaseFinished', [P, id, bought]); }
  }
  /* developer product: ProcessReceipt until the game grants it (Roblox retries) */
  receipt(uid, id, price, tries = 0) {
    const cb = this.rt.service('MarketplaceService').props.get('ProcessReceipt'); if (typeof cb !== 'function') { if (tries < 20) setTimeout(() => this.receipt(uid, id, price, tries + 1), 1500); return; }
    const info = LuaTable.from({ PlayerId: uid, ProductId: id, PurchaseId: (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)), CurrencySpent: price, CurrencyType: enumItem('CurrencyType', 'Robux'), PlaceIdWherePurchased: 0 });
    const I = this.E.I, prev = I.side; I.side = 'server';
    this.rt.spawn(fn(() => { let r; try { r = call(cb, [info])[0]; } catch (e) { this.rt.report?.(e); } if (!(r && r.name === 'PurchaseGranted') && tries < 5) setTimeout(() => this.receipt(uid, id, price, tries + 1), 3000); return []; }), []); I.side = prev;
  }
  install() {
    const CM = this.rt.classMethods, self = this; const M = this.rt.service('MarketplaceService');
    for (const ev of ['PromptProductPurchaseFinished', 'PromptGamePassPurchaseFinished', 'PromptPurchaseFinished', 'PromptBundlePurchaseFinished', 'PromptSubscriptionPurchaseFinished', 'PromptPremiumPurchaseFinished']) M.sig(ev);
    const later = (f) => fn((a) => { Promise.resolve().then(() => f(a)); return []; });
    CM.MarketplaceService = { ...(CM.MarketplaceService || {}),
      PromptProductPurchase: later((a) => self.prompt('product', a[1], a[2])), PromptGamePassPurchase: later((a) => self.prompt('pass', a[1], a[2])), PromptPurchase: later((a) => self.prompt('asset', a[1], a[2])),
      PromptBundlePurchase: later((a) => self.prompt('bundle', a[1], a[2])), PromptSubscriptionPurchase: later((a) => self.prompt('product', a[1], a[2])), PromptPremiumPurchase: later(() => {}),
      UserOwnsGamePassAsync: fn((a) => [self.has('pass', a[2])]), PlayerOwnsAsset: fn((a) => [self.has('asset', a[2])]), PlayerOwnsBundle: fn((a) => [self.has('asset', a[2])]),
      GetProductInfo: fn((a) => { const id = Number(a[1]), t = a[2] && a[2].name; const k = t === 'GamePass' ? 'pass' : t === 'Product' ? 'product' : 'asset'; const d = self.info.get(k + id); if (!d) self.details(k, id);
        return [LuaTable.from({ Name: d ? d.Name : 'Produit', Description: d ? d.Description : '', PriceInRobux: d && d.PriceInRobux != null ? d.PriceInRobux : 0, IconImageAssetId: d ? d.IconImageAssetId : 0, AssetId: id, ProductId: id, IsForSale: true, IsPublicDomain: false, Creator: LuaTable.from({ Name: 'Roblox', CreatorType: 'User', Id: 1 }) })]; }),
      GetDeveloperProductsAsync: fn(() => [new Instance('Pages', self.rt)]), GetSubscriptionProductInfoAsync: fn(() => [new LuaTable()]), GetUserSubscriptionStatusAsync: fn(() => [LuaTable.from({ IsSubscribed: false, IsRenewing: false })]),
    };
  }
}
