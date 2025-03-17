# Game Center Tombala

Bu proje, Oyun Merkezi platformu için geliştirilen Tombala oyununu içermektedir. Lerna monorepo yapısı kullanılarak oluşturulmuştur.

## Proje Yapısı

```
game-center-tombala/
├── packages/
│   ├── common/ (Ortak utilities ve tipler)
│   └── game/ (Tombala oyun uygulaması)
├── lerna.json
└── package.json
```

## Kurulum

Bu projeyi kurmak için aşağıdaki adımları izleyin:

```bash
# Depoyu klonla
git clone https://github.com/yourusername/game-center-tombala.git

# Proje dizinine gir
cd game-center-tombala

# Bağımlılıkları yükle
npm install

# Lerna bootstrap ile paketleri kur
npm run bootstrap

# Geliştirme modunda başlat
npm run dev
```

## Paketler

### @tombala/common

Ortak tipler, API istekleri ve yardımcı fonksiyonlar için kullanılan paket.

### @tombala/game

Tombala oyununun kullanıcı arayüzü ve oyun mantığını içeren paket.

## Geliştirme

Geliştirme modunda projeyi başlatmak için:

```bash
npm run dev
```

## Dağıtım (Build)

Projeyi derlemek (build) için:

```bash
npm run build
```