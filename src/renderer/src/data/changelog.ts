import type { AppLocale } from "@shared/ipc"

/** A string localized into every supported locale. */
type L = Record<AppLocale, string>
/** A string list localized into every supported locale. */
type LList = Record<AppLocale, string[]>

export type ChangeKind = "added" | "changed" | "fixed" | "removed"

export interface ChangelogEntry {
  version: string
  date: string
  title: L
  summary: L
  changes: Partial<Record<ChangeKind, LList>>
}

/**
 * Structured, fully-localized Minecraft release notes. Kept as data (not raw
 * i18n keys) so every entry carries its own translations and the News screen
 * can group changes by kind. Newest first.
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.21",
    date: "2024-06-13",
    title: { en: "Tricky Trials", ru: "Коварные испытания", es: "Pruebas Peligrosas", zh: "诡异的试炼" },
    summary: {
      en: "Trial chambers, the mace and a wave of new combat content.",
      ru: "Испытательные камеры, булава и волна нового боевого контента.",
      es: "Cámaras de prueba, la maza y una oleada de contenido de combate.",
      zh: "试炼密室、重锤以及大量新的战斗内容。",
    },
    changes: {
      added: {
        en: ["Trial chambers with trial spawners and vaults", "The mace — a heavy new weapon", "Breeze and bogged mobs plus wind charges", "Crafter block for automated crafting"],
        ru: ["Испытательные камеры с испытательными спавнерами и хранилищами", "Булава — новое тяжёлое оружие", "Мобы бриз и трясинник, а также заряды ветра", "Блок «Сборщик» для автоматического крафта"],
        es: ["Cámaras de prueba con generadores y bóvedas", "La maza, una nueva arma pesada", "Mobs brisa y empantanado, además de cargas de viento", "Bloque ensamblador para fabricación automática"],
        zh: ["带有试炼刷怪笼和宝库的试炼密室", "重锤——全新的重型武器", "旋风人和沼骸，以及风弹", "合成器方块用于自动合成"],
      },
      changed: {
        en: ["Enchanting rebalanced around new resources", "Ominous trials add harder variants"],
        ru: ["Зачарование перебалансировано под новые ресурсы", "Зловещие испытания добавляют сложные варианты"],
        es: ["Encantamientos reequilibrados con nuevos recursos", "Las pruebas ominosas añaden variantes más difíciles"],
        zh: ["附魔围绕新资源重新平衡", "不祥试炼加入更难的变体"],
      },
      fixed: {
        en: ["Numerous mob pathfinding and lighting fixes"],
        ru: ["Множество исправлений поиска пути мобов и освещения"],
        es: ["Numerosas correcciones de pathfinding e iluminación"],
        zh: ["修复了大量生物寻路与光照问题"],
      },
    },
  },
  {
    version: "1.20",
    date: "2023-06-07",
    title: { en: "Trails & Tales", ru: "Тропы и тайны", es: "Senderos y Relatos", zh: "征程与探索" },
    summary: {
      en: "Archaeology, cherry groves, camels and self-expression.",
      ru: "Археология, вишнёвые рощи, верблюды и самовыражение.",
      es: "Arqueología, arboledas de cerezo, camellos y expresión personal.",
      zh: "考古、樱花树林、骆驼与自我表达。",
    },
    changes: {
      added: {
        en: ["Archaeology with brushes and suspicious sand", "Cherry grove biome and pink petals", "Camels, sniffers and the sniffer egg", "Bamboo wood set and hanging signs"],
        ru: ["Археология с кистями и подозрительным песком", "Биом вишнёвой рощи и розовые лепестки", "Верблюды, нюхачи и яйцо нюхача", "Набор бамбукового дерева и висячие таблички"],
        es: ["Arqueología con pinceles y arena sospechosa", "Bioma de arboleda de cerezos y pétalos rosas", "Camellos, olfateadores y el huevo de olfateador", "Set de madera de bambú y letreros colgantes"],
        zh: ["使用刷子和可疑沙子的考古", "樱花树林生物群系与粉色花瓣", "骆驼、嗅探兽及其蛋", "竹木套装与悬挂告示牌"],
      },
      changed: {
        en: ["Armor trims for cosmetic customization", "Smithing table reworked for upgrades"],
        ru: ["Отделка брони для косметической настройки", "Стол кузнеца переработан под улучшения"],
        es: ["Adornos de armadura para personalización", "Mesa de herrería rediseñada para mejoras"],
        zh: ["盔甲纹饰用于外观自定义", "锻造台重做以用于升级"],
      },
      fixed: {
        en: ["Stability fixes for world generation edges"],
        ru: ["Исправления стабильности на границах генерации мира"],
        es: ["Correcciones de estabilidad en bordes de generación"],
        zh: ["修复世界生成边界的稳定性问题"],
      },
    },
  },
  {
    version: "1.19",
    date: "2022-06-07",
    title: { en: "The Wild Update", ru: "Дикое обновление", es: "La Actualización Salvaje", zh: "荒野更新" },
    summary: {
      en: "The deep dark, the warden and mangrove swamps.",
      ru: "Глубокий мрак, страж и мангровые болота.",
      es: "La oscuridad profunda, el guardián y los pantanos de mangle.",
      zh: "深暗之域、监守者与红树林沼泽。",
    },
    changes: {
      added: {
        en: ["Deep dark biome and ancient cities", "The warden — a blind but deadly mob", "Mangrove swamps and the frog family", "Allay, the helpful item-gathering mob"],
        ru: ["Биом глубокого мрака и древние города", "Страж — слепой, но смертоносный моб", "Мангровые болота и семейство лягушек", "Аллей — полезный моб, собирающий предметы"],
        es: ["Bioma de oscuridad profunda y ciudades antiguas", "El guardián, un mob ciego pero letal", "Pantanos de mangle y la familia de las ranas", "El allay, un mob recolector de objetos"],
        zh: ["深暗之域生物群系与远古城市", "监守者——失明却致命的生物", "红树林沼泽与青蛙家族", "悦灵——乐于收集物品的生物"],
      },
      changed: {
        en: ["Sculk blocks spread and react to sound"],
        ru: ["Блоки скалка распространяются и реагируют на звук"],
        es: ["Los bloques de sculk se propagan y reaccionan al sonido"],
        zh: ["幽匿方块会蔓延并对声音作出反应"],
      },
      fixed: {
        en: ["Improved boat handling and mob spawning"],
        ru: ["Улучшено управление лодкой и спавн мобов"],
        es: ["Mejor manejo de botes y generación de mobs"],
        zh: ["改进船只操控与生物生成"],
      },
    },
  },
  {
    version: "1.18",
    date: "2021-11-30",
    title: { en: "Caves & Cliffs II", ru: "Пещеры и скалы II", es: "Cuevas y Acantilados II", zh: "洞穴与山崖 II" },
    summary: {
      en: "Taller worlds and dramatic new terrain generation.",
      ru: "Более высокие миры и впечатляющая генерация ландшафта.",
      es: "Mundos más altos y una nueva generación de terreno.",
      zh: "更高的世界与全新的地形生成。",
    },
    changes: {
      added: {
        en: ["Lush caves and dripstone caves", "New mountain biomes and grimstone"],
        ru: ["Пышные пещеры и сталактитовые пещеры", "Новые горные биомы и глубинный камень"],
        es: ["Cuevas exuberantes y de infragoteo", "Nuevos biomas de montaña y piedra abismal"],
        zh: ["繁茂洞穴与溶洞", "新的山地生物群系与深板岩"],
      },
      changed: {
        en: ["World height extended from -64 to 320", "Overhauled terrain and noise caves"],
        ru: ["Высота мира расширена с -64 до 320", "Переработан ландшафт и шумовые пещеры"],
        es: ["Altura del mundo de -64 a 320", "Terreno y cuevas de ruido rediseñados"],
        zh: ["世界高度扩展至 -64 到 320", "重做地形与噪声洞穴"],
      },
      fixed: {
        en: ["Performance improvements for chunk loading"],
        ru: ["Улучшения производительности загрузки чанков"],
        es: ["Mejoras de rendimiento al cargar chunks"],
        zh: ["改进区块加载性能"],
      },
    },
  },
  {
    version: "1.17",
    date: "2021-06-08",
    title: { en: "Caves & Cliffs I", ru: "Пещеры и скалы I", es: "Cuevas y Acantilados I", zh: "洞穴与山崖 I" },
    summary: {
      en: "New mobs, blocks and copper ahead of the terrain overhaul.",
      ru: "Новые мобы, блоки и медь перед переработкой ландшафта.",
      es: "Nuevos mobs, bloques y cobre antes del rediseño del terreno.",
      zh: "在地形重做之前加入新生物、方块与铜。",
    },
    changes: {
      added: {
        en: ["Copper ore, blocks and the lightning rod", "Axolotls, glow squid and goats", "Amethyst geodes and tinted glass", "Candles and the spyglass"],
        ru: ["Медная руда, блоки и громоотвод", "Аксолотли, светящиеся кальмары и козы", "Аметистовые жеоды и тонированное стекло", "Свечи и подзорная труба"],
        es: ["Mineral y bloques de cobre y el pararrayos", "Ajolotes, calamares luminosos y cabras", "Geodas de amatista y vidrio tintado", "Velas y el catalejo"],
        zh: ["铜矿石、铜块与避雷针", "美西螈、发光鱿鱼与山羊", "紫水晶晶洞与灰色玻璃", "蜡烛与望远镜"],
      },
      changed: {
        en: ["Copper oxidizes over time into unique tones"],
        ru: ["Медь со временем окисляется в уникальные оттенки"],
        es: ["El cobre se oxida con el tiempo en tonos únicos"],
        zh: ["铜会随时间氧化出独特色调"],
      },
    },
  },
  {
    version: "1.16",
    date: "2020-06-23",
    title: { en: "Nether Update", ru: "Обновление Нижнего мира", es: "Actualización del Nether", zh: "下界更新" },
    summary: {
      en: "A complete overhaul of the Nether with biomes and factions.",
      ru: "Полная переработка Нижнего мира с биомами и фракциями.",
      es: "Una revisión completa del Nether con biomas y facciones.",
      zh: "对下界的全面革新，加入生物群系与阵营。",
    },
    changes: {
      added: {
        en: ["Nether biomes: soul sand valley, warped forest and more", "Netherite gear and ancient debris", "Piglins, hoglins and striders", "Respawn anchors and the target block"],
        ru: ["Биомы Нижнего мира: долина песка душ, искажённый лес и другие", "Незеритовое снаряжение и древние обломки", "Пиглины, хоглины и страйдеры", "Якоря возрождения и блок-мишень"],
        es: ["Biomas del Nether: valle de arena de almas, bosque deformado y más", "Equipo de netherita y escombros antiguos", "Piglins, hoglins y lava-andantes", "Anclas de resurgir y el bloque objetivo"],
        zh: ["下界生物群系：灵魂沙峡谷、诡异森林等", "下界合金装备与远古残骸", "猪灵、疣猪兽与炽足兽", "重生锚与标靶方块"],
      },
      changed: {
        en: ["Piglins barter and react to gold armor"],
        ru: ["Пиглины торгуются и реагируют на золотую броню"],
        es: ["Los piglins comercian y reaccionan a la armadura de oro"],
        zh: ["猪灵会以物易物并对金装备作出反应"],
      },
      removed: {
        en: ["Zombie pigmen replaced by zombified piglins"],
        ru: ["Зомби-свиньи заменены на зомбированных пиглинов"],
        es: ["Los cerdos zombis fueron reemplazados por piglins zombificados"],
        zh: ["僵尸猪人被僵尸猪灵取代"],
      },
    },
  },
]
