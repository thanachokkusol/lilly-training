import { useEffect, useState } from "react";
import { ChevronRight, Dumbbell, Plus, Search } from "lucide-react";
import { Empty, Modal, useData } from "./App";
import BodyMap from "./BodyMap";
import { allEntries, save } from "./db";
import { catalogMachineId, equipmentLabels, loadCatalog, machineFromCatalog, machinesOf, noGym, recordLabels, searchCatalog, type CatalogItem } from "./catalog";
import { gymName, gymsFor } from "./gyms";
import { categoryLabel, muscleIds, muscleLabels, muscleText } from "./muscles";
import type { Entry } from "./types";

/** undefined while loading, null when it could not be read. */
export function useCatalog(needed = true) {
  const [items, setItems] = useState<CatalogItem[] | null | undefined>(undefined);
  useEffect(() => {
    if (!needed) return;
    let live = true;
    loadCatalog().then((all) => { if (live) setItems(all); }).catch(() => { if (live) setItems(null); });
    return () => { live = false; };
  }, [needed]);
  return items;
}
/** The machine of ours for a universal exercise at a gym; made the first time it is needed, never twice. */
export async function ensureCatalogMachine(item: CatalogItem, gym: string): Promise<Entry> {
  const existing = machinesOf(await allEntries(), item.id).find((e) => e.data.gym === gym);
  return existing ?? save("machine", machineFromCatalog(item, gym), catalogMachineId(item.id, gym));
}
const subtitle = (item: CatalogItem) => `${categoryLabel(item.primary)} · ${equipmentLabels[item.equipment]}`;
const imageUrl = (file: string) => `${import.meta.env.BASE_URL}catalog/${file}`;

export function ImageCredit() {
  return (
    <small className="image-credit">
      ภาพ: Everkinetic, <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noreferrer">CC BY-SA 3.0</a>{" "}
      ผ่าน <a href="https://wger.de" target="_blank" rel="noreferrer">wger.de</a> (ย่อขนาดและแปลงไฟล์ สัญญาเดียวกัน)
    </small>
  );
}
function Steps({ item, images }: { item: CatalogItem; images: boolean }) {
  return (
    <>
      {images && item.images && (
        <figure className="catalog-images">
          {item.images.map((file) => <img key={file} loading="lazy" src={imageUrl(file)} alt={`${item.th} ภาพประกอบ`} />)}
          <figcaption><ImageCredit /></figcaption>
        </figure>
      )}
      <ol className="catalog-steps">{item.steps.map((step, i) => <li key={i}>{step}</li>)}</ol>
      {item.caution && <p className="catalog-caution"><strong>ข้อควรระวัง:</strong> {item.caution}</p>}
      {item.note && <p><strong>หมายเหตุ:</strong> {item.note}</p>}
    </>
  );
}
/** The universal how-to under a machine's own notes. Pictures only when the machine has none of its own. */
export function HowTo({ catalogId, images, open }: { catalogId: string; images: boolean; open: boolean }) {
  const items = useCatalog();
  const item = items?.find(({ id }) => id === catalogId);
  if (!item) return null;
  return (
    <details className="how-to" open={open}>
      <summary>วิธีทำละเอียด · {item.th}</summary>
      <Steps item={item} images={images} />
    </details>
  );
}

export function CatalogDetail({ item, close, openMachine }: { item: CatalogItem; close: () => void; openMachine: (id: string) => void }) {
  const { entries, run, refresh } = useData();
  const [gym, setGym] = useState(noGym);
  const mine = machinesOf(entries, item.id);
  const here = mine.find((e) => e.data.gym === gym);
  const gyms = gymsFor(entries).filter((g) => !g.archived);
  return (
    <Modal title={item.th} close={close}>
      <div className="detail-body">
        <div className="focus-title">
          <small>{subtitle(item)} · {recordLabels[item.record]}</small>
          <h3>{item.th}</h3>
          <p className="muted">{item.en}</p>
        </div>
        <div className="muscle-focus">
          <BodyMap sets={Object.fromEntries([...item.secondary.map((m) => [m, 0.4]), [item.primary, 1]])} />
          <div>
            <p><strong>เน้น:</strong> {muscleLabels[item.primary]}</p>
            {item.secondary.length > 0 && <p><strong>ช่วย:</strong> {muscleText(item.secondary)}</p>}
            {item.detail && <p><strong>อุปกรณ์:</strong> {item.detail}</p>}
          </div>
        </div>
        <div>
          <h4>วิธีทำ</h4>
          <Steps item={item} images />
        </div>
        {mine.length > 0 && (
          <div>
            <h4>เครื่องของเรา</h4>
            {mine.map((e) => (
              <button key={e.id} className="select-row" onClick={() => openMachine(e.id)}>
                <span>{e.data.name}<small>{[gymName(entries, e.data.gym), e.data.label].filter(Boolean).join(" · ")}</small></span>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
        )}
        <div className="sticky-actions catalog-add edit-only">
          <select aria-label="เพิ่มเข้ายิม" value={gym} onChange={(e) => setGym(e.target.value)}>
            {gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button className="primary" onClick={() => here ? openMachine(here.id) : run(async () => {
            const machine = await ensureCatalogMachine(item, gym);
            await refresh();
            openMachine(machine.id);
          }, gym === noGym ? "เพิ่มท่าแล้ว" : `เพิ่มเข้า ${gymName(entries, gym)} แล้ว`)}>
            {here ? "เปิดเครื่องนี้" : <><Plus size={17} /> เพิ่มท่านี้</>}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CatalogRow({ item, entries, onClick, add }: { item: CatalogItem; entries: Entry[]; onClick: () => void; add?: boolean }) {
  const places = [...new Set(machinesOf(entries, item.id).map((e) => gymName(entries, e.data.gym)))];
  return (
    <button type="button" className="catalog-row" onClick={onClick}>
      {item.images ? <img loading="lazy" src={imageUrl(item.images[0])} alt="" /> : <span className="catalog-icon"><Dumbbell size={20} aria-hidden="true" /></span>}
      <span>
        <strong>{item.th}</strong>
        <small>{item.en}</small>
        <small>{subtitle(item)}{places.length > 0 && ` · มีที่ ${places.join(", ")}`}</small>
      </span>
      {add ? <Plus size={17} /> : <ChevronRight size={17} />}
    </button>
  );
}
export function CatalogBrowser({ openMachine }: { openMachine: (id: string) => void }) {
  const { entries } = useData();
  const items = useCatalog();
  const [query, setQuery] = useState(""), [muscle, setMuscle] = useState(""), [equipment, setEquipment] = useState("");
  const [shown, setShown] = useState(40), [selected, setSelected] = useState<CatalogItem | null>(null);
  if (items === null) return <Empty text="เปิดคลังท่าไม่สำเร็จ เชื่อมต่ออินเทอร์เน็ตแล้วเปิดหน้านี้ใหม่" />;
  if (!items) return <Empty text="กำลังเปิดคลังท่า…" />;
  const found = searchCatalog(items, query, muscle, equipment);
  const change = (set: (value: string) => void) => (value: string) => { set(value); setShown(40); };
  return (
    <section className="catalog">
      <div className="toolbar">
        <label className="search">
          <Search size={18} />
          <input aria-label="ค้นหาในคลังท่า" placeholder="ค้นหาชื่อไทยหรืออังกฤษ" value={query} onChange={(e) => change(setQuery)(e.target.value)} />
        </label>
        <select aria-label="กล้ามเนื้อ" value={muscle} onChange={(e) => change(setMuscle)(e.target.value)}>
          <option value="">ทุกกล้ามเนื้อ</option>
          {muscleIds.map((id) => <option key={id} value={id}>{muscleLabels[id]}</option>)}
        </select>
        <select aria-label="อุปกรณ์" value={equipment} onChange={(e) => change(setEquipment)(e.target.value)}>
          <option value="">ทุกอุปกรณ์</option>
          {Object.entries(equipmentLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>
      <p className="muted" role="status">{found.length} ท่า</p>
      <div className="catalog-list">
        {found.slice(0, shown).map((item) => <CatalogRow key={item.id} item={item} entries={entries} onClick={() => setSelected(item)} />)}
      </div>
      {!found.length && <Empty text="ไม่พบท่าที่ค้นหา ลองคำอื่นหรือล้างตัวกรอง" />}
      {found.length > shown && <button className="secondary wide" onClick={() => setShown(shown + 40)}>แสดงเพิ่ม ({found.length - shown})</button>}
      {found.slice(0, shown).some((item) => item.images) && <ImageCredit />}
      {selected && <CatalogDetail item={selected} close={() => setSelected(null)} openMachine={(id) => { setSelected(null); openMachine(id); }} />}
    </section>
  );
}
/** Search results from the library inside a picker; choosing one adds it to the gym of that workout. */
export function CatalogSearch({ query, gym, choose }: { query: string; gym: string; choose: (machine: Entry) => void }) {
  const { entries, run, refresh } = useData();
  const items = useCatalog(query.trim().length > 1);
  if (!items || query.trim().length < 2) return null;
  const found = searchCatalog(items, query).filter((item) => !machinesOf(entries, item.id).some((e) => e.data.gym === gym)).slice(0, 12);
  if (!found.length) return null;
  return (
    <div className="catalog-list" role="group" aria-label="จากคลังท่าสากล">
      <p className="muted">จากคลังท่าสากล</p>
      {found.map((item) => <CatalogRow key={item.id} item={item} entries={entries} add onClick={() => run(async () => {
        const machine = await ensureCatalogMachine(item, gym);
        await refresh();
        choose(machine);
      })} />)}
      {found.some((item) => item.images) && <ImageCredit />}
    </div>
  );
}
