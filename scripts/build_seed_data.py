# -*- coding: utf-8 -*-
"""
Build Seed Data for Auravedic Cross-Channel Performance Dashboard
Combines:
1. Context Handbook figures (Apr-Oct 2026, 43 base products, 5 Meta accounts, settlement, Flipkart)
2. BusinessReport-14-10-26 (1).csv (56 Amazon ASINs, traffic, units ordered)
3. Copy of Shan-Report-Sheet.xlsx (Amazon Ads, Google Ads, Meta Ads, FKT, Nykaa, Myntra, Unit Economics Sheet31, Amz-Inventory Plan)
"""

import sys, os, json, csv, openpyxl

sys.stdout.reconfigure(encoding='utf-8')

# Paths
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
parent_dir = os.path.dirname(base_dir)
out_dir = os.path.join(base_dir, 'src', 'data')
os.makedirs(out_dir, exist_ok=True)

# 1. Base Products (43 physical items)
BASE_PRODUCTS = [
    {"key": "K100", "name": "Kumkumadi Oil 100ml", "category": "Face Oil / Serum", "mrp": 1250, "defaultCost": 125, "hero": True},
    {"key": "K30", "name": "Kumkumadi Tailam 30ml", "category": "Face Oil / Serum", "mrp": 550, "defaultCost": 125, "hero": False},
    {"key": "KMA", "name": "Kumkuma Oil 100ml (Formula B)", "category": "Face Oil", "mrp": 850, "defaultCost": 125, "hero": False},
    {"key": "SBO", "name": "Skin Brightening Oil 100ml", "category": "Face Oil", "mrp": 650, "defaultCost": 125, "hero": False},
    {"key": "KNS", "name": "Kumkumadi Night Serum 50ml", "category": "Serum", "mrp": 699, "defaultCost": 125, "hero": False},
    {"key": "KGEL", "name": "Kumkumadi Gel 100g", "category": "Gel / Moisturizer", "mrp": 450, "defaultCost": 125, "hero": False},
    {"key": "KNC", "name": "Kumkumadi Night Cream 50g", "category": "Night Cream", "mrp": 650, "defaultCost": 125, "hero": True},
    {"key": "KC", "name": "Kumkumadi Cream 100g", "category": "Cream", "mrp": 490, "defaultCost": 125, "hero": False},
    {"key": "RBMO", "name": "Relaxing Body Massage Oil 200ml", "category": "Body Oil", "mrp": 599, "defaultCost": 125, "hero": False},
    {"key": "BTMO", "name": "Body Toning Massage Oil 200ml", "category": "Body Oil", "mrp": 599, "defaultCost": 125, "hero": False},
    {"key": "VCO", "name": "Vitamin C Oil 100ml", "category": "Face Oil", "mrp": 550, "defaultCost": 125, "hero": False},
    {"key": "VCC", "name": "Vitamin C Cream", "category": "Cream", "mrp": 450, "defaultCost": 125, "hero": False},
    {"key": "DTC", "name": "De-tan Cream 100g", "category": "Cream", "mrp": 450, "defaultCost": 125, "hero": False},
    {"key": "DSC", "name": "Dark Spot Corrector Cream", "category": "Cream", "mrp": 499, "defaultCost": 125, "hero": False},
    {"key": "FO", "name": "Firming Age Repair Oil 100ml", "category": "Face Oil", "mrp": 650, "defaultCost": 125, "hero": False},
    {"key": "ARP", "name": "Age Repair Face Polish", "category": "Scrub / Polish", "mrp": 399, "defaultCost": 125, "hero": False},
    {"key": "UO", "name": "Ultra Skin Oil (Vitamin E) 100ml", "category": "Face Oil", "mrp": 550, "defaultCost": 125, "hero": False},
    {"key": "PS", "name": "Pigmentation Serum 30ml", "category": "Serum", "mrp": 599, "defaultCost": 125, "hero": False},
    {"key": "NL", "name": "Nalpamaradi Thailam 100ml", "category": "Face & Body Oil", "mrp": 650, "defaultCost": 125, "hero": False},
    {"key": "SLM", "name": "Skin Lightening Mask 100g", "category": "Face Mask", "mrp": 425, "defaultCost": 125, "hero": False},
    {"key": "ACS", "name": "Acne Calming Sunscreen SPF50", "category": "Sunscreen", "mrp": 499, "defaultCost": 125, "hero": False},
    {"key": "ACFM", "name": "Acne Clearing Face Mask 100g", "category": "Face Mask", "mrp": 399, "defaultCost": 125, "hero": False},
    {"key": "NTFW", "name": "Acne Clearing Face Wash (Tea Tree) 120ml", "category": "Face Wash", "mrp": 375, "defaultCost": 125, "hero": False},
    {"key": "TTS", "name": "Tea Tree Serum 30ml", "category": "Serum", "mrp": 499, "defaultCost": 125, "hero": False},
    {"key": "CSSM", "name": "Chia Seeds Sleep Mask", "category": "Sleep Mask", "mrp": 499, "defaultCost": 125, "hero": False},
    {"key": "RWT", "name": "Rose Water Toner 100ml", "category": "Toner", "mrp": 299, "defaultCost": 125, "hero": False},
    {"key": "AG", "name": "Aloevera Gel 100g", "category": "Gel", "mrp": 275, "defaultCost": 125, "hero": False},
    {"key": "HGS", "name": "Hair Growth Serum 30ml", "category": "Hair Care", "mrp": 699, "defaultCost": 125, "hero": False},
    {"key": "HCS", "name": "Hairfall Control Shampoo 500ml", "category": "Hair Care", "mrp": 499, "defaultCost": 125, "hero": False},
    {"key": "HM", "name": "Hair Mask 150g", "category": "Hair Care", "mrp": 499, "defaultCost": 125, "hero": False},
    {"key": "RHO", "name": "Rosemary Hair Oil 100ml", "category": "Hair Care", "mrp": 599, "defaultCost": 125, "hero": True},
    {"key": "RHM", "name": "Rosemary Hair Mist 100ml", "category": "Hair Care", "mrp": 399, "defaultCost": 125, "hero": False},
    {"key": "RS", "name": "Rosemary Shampoo 250ml", "category": "Hair Care", "mrp": 450, "defaultCost": 125, "hero": False},
    {"key": "OHO", "name": "Onion Hair Oil 100ml", "category": "Hair Care", "mrp": 499, "defaultCost": 125, "hero": False},
    {"key": "PHO", "name": "Protective Hair Oil 100ml", "category": "Hair Care", "mrp": 499, "defaultCost": 125, "hero": False},
    {"key": "KFW", "name": "Kumkumadi Face Wash 100ml", "category": "Face Wash", "mrp": 375, "defaultCost": 125, "hero": False},
    {"key": "KM", "name": "Kumkumadi Mask 100g", "category": "Face Mask", "mrp": 425, "defaultCost": 125, "hero": False},
    {"key": "KUEC", "name": "Kumkumadi Under Eye Cream 25g", "category": "Eye Cream", "mrp": 499, "defaultCost": 125, "hero": False},
    {"key": "KUFW", "name": "Kumkumadi Ubtan Face Wash", "category": "Face Wash", "mrp": 399, "defaultCost": 125, "hero": False},
    {"key": "KSM", "name": "Kumkumadi Sleep Mask 50g", "category": "Sleep Mask", "mrp": 549, "defaultCost": 125, "hero": False},
    {"key": "KMO", "name": "Kumkumadi Body Massage Oil 200ml", "category": "Body Oil", "mrp": 699, "defaultCost": 125, "hero": False},
    {"key": "KBS", "name": "Kumkumadi Brightening Serum SPF50", "category": "Sunscreen / Serum", "mrp": 599, "defaultCost": 125, "hero": False},
    {"key": "KT", "name": "Kumkumadi Toner 100ml", "category": "Toner", "mrp": 349, "defaultCost": 125, "hero": False}
]

# 2. Key Combo Recipes (mapping finished listings to base products)
RECIPES = [
    {"code": "AV-K100", "title": "Kumkumadi Oil 100ml (Single)", "type": "S", "channel": "Shopify", "parts": {"K100": 1}, "sellingPrice": 999},
    {"code": "AV-KNC", "title": "Kumkumadi Retinol Night Cream 50g (Single)", "type": "S", "channel": "Shopify", "parts": {"KNC": 1}, "sellingPrice": 585},
    {"code": "AV-RHO", "title": "Rosemary Hair Oil 100ml (Single)", "type": "S", "channel": "Shopify", "parts": {"RHO": 1}, "sellingPrice": 499},
    {"code": "AV-KGs", "title": "Kumkumadi Glowing Skin Combo (Oil + Gel + Cream)", "type": "C", "channel": "Shopify", "parts": {"K100": 1, "KGEL": 1, "KC": 1}, "sellingPrice": 999},
    {"code": "AV-KB", "title": "Kumkumadi Brightening Duo (Oil + Cream)", "type": "C", "channel": "Shopify", "parts": {"K100": 1, "KC": 1}, "sellingPrice": 739},
    {"code": "AV-KNS", "title": "Kumkumadi Night Serum Single", "type": "S", "channel": "Shopify", "parts": {"KNS": 1}, "sellingPrice": 699},
    {"code": "AV-KNS-KNC", "title": "Kumkumadi Night Serum + Retinol Night Cream Duo", "type": "C", "channel": "Shopify", "parts": {"KNS": 1, "KNC": 1}, "sellingPrice": 899},
    {"code": "AV-RHO-RHM", "title": "Rosemary Hair Growth Duo (Oil + Mist)", "type": "C", "channel": "Shopify", "parts": {"RHO": 1, "RHM": 1}, "sellingPrice": 799},
    {"code": "AV-220", "title": "Kumkumadi Glowing Skin Ritual Set", "type": "C", "channel": "Shopify", "parts": {"K100": 1, "KGEL": 1, "KC": 1}, "sellingPrice": 1225},
    {"code": "B00YXTNFJC", "title": "Auravedic Kumkumadi Oil 100ml", "type": "S", "channel": "Amazon", "parts": {"K100": 1}, "sellingPrice": 999},
    {"code": "B0FRS7F5J7", "title": "Auravedic Rosemary Hair Oil 100ml", "type": "S", "channel": "Amazon", "parts": {"RHO": 1}, "sellingPrice": 499},
    {"code": "B09TR4VB8T", "title": "Auravedic Relaxing Body Massage Oil 200ml", "type": "S", "channel": "Amazon", "parts": {"RBMO": 1}, "sellingPrice": 549},
    {"code": "B0DS5XLXBX", "title": "Auravedic Kumkuma Oil 100ml", "type": "S", "channel": "Amazon", "parts": {"KMA": 1}, "sellingPrice": 799},
    {"code": "B09NPQ69SS", "title": "Auravedic Kumkumadi Tailam 30ml", "type": "S", "channel": "Amazon", "parts": {"K30": 1}, "sellingPrice": 499},
    {"code": "B0DRSHKHW4", "title": "Auravedic Kumkumadi Retinol Night Cream 50g", "type": "S", "channel": "Amazon", "parts": {"KNC": 1}, "sellingPrice": 585},
    {"code": "B00H96CHVI", "title": "Auravedic Skin Brightening Serum Face Oil 100ml", "type": "S", "channel": "Amazon", "parts": {"SBO": 1}, "sellingPrice": 599},
    {"code": "B076Q1NVQV", "title": "Auravedic Kumkumadi Oil 100ml & Ashwagandha Combo", "type": "C", "channel": "Amazon", "parts": {"K100": 1, "SBO": 1}, "sellingPrice": 1199},
    {"code": "B07S35TM39", "title": "Auravedic Kumkumadi Gel 100g", "type": "S", "channel": "Amazon", "parts": {"KGEL": 1}, "sellingPrice": 425}
]

# 3. Unit Economics from Sheet31 (with tier and margin analysis)
UNIT_ECONOMICS = {
    "KGs": {"name": "Kumkumadi Glowing Skin Combo", "cogs": 300.0, "shipping": 85.0, "metaCAC": 445.0, "sellingPrice": 999.0, "rtoCost": 166.0, "netProfitWithRTO": 3.0, "netProfitWithoutRTO": 169.0, "marginPercent": 0.3},
    "KB": {"name": "Kumkumadi Brightening Duo", "cogs": 200.0, "shipping": 85.0, "metaCAC": 330.0, "sellingPrice": 739.0, "rtoCost": 123.0, "netProfitWithRTO": 1.0, "netProfitWithoutRTO": 124.0, "marginPercent": 0.1},
    "KNS": {"name": "Kumkumadi Night Serum Single", "cogs": 100.0, "shipping": 85.0, "metaCAC": 395.0, "sellingPrice": 699.0, "rtoCost": 116.0, "netProfitWithRTO": 3.0, "netProfitWithoutRTO": 119.0, "marginPercent": 0.4},
    "KNS+KNC": {"name": "Kumkumadi Night Serum + Retinol Night Cream", "cogs": 250.0, "shipping": 85.0, "metaCAC": 610.0, "sellingPrice": 899.0, "rtoCost": 189.0, "netProfitWithRTO": -235.0, "netProfitWithoutRTO": -46.0, "marginPercent": -26.1},
    "DEFAULT": {"name": "Standard Baseline Assumption", "cogs": 125.0, "shipping": 65.0, "metaCAC": 380.0, "sellingPrice": 650.0, "rtoCost": 110.0, "netProfitWithRTO": 75.0, "netProfitWithoutRTO": 160.0, "marginPercent": 11.5}
}

# 4. Monthly Baseline Numbers (April - October 2026)
MONTHLY_PERFORMANCE = [
    {
        "month": "Apr 2026",
        "shopifyPreReturns": 1880000,
        "shopifyNet": 1690000,
        "amazonSales": 3470000,
        "totalSales": 5350000,
        "flipkartSalesEst": 850000,
        "metaSpend": 1180000,
        "googleSpend": 290000,
        "totalAdsIncluded": 1470000,
        "amazonAdsSpendEst": 680000,
        "flipkartAdsSpend": 180000,
        "salesPerRupeeAd": 3.63,
        "amazonShare": 64.9,
        "shopifyOrders": 3121,
        "amazonOrders": 7559,
        "metaROAS": 1.48,
        "googleROAS": 2.56,
        "realisticNetProfit": 1185000,
        "contributionMargin": 22.1
    },
    {
        "month": "May 2026",
        "shopifyPreReturns": 1890000,
        "shopifyNet": 1710000,
        "amazonSales": 3650000,
        "totalSales": 5540000,
        "flipkartSalesEst": 890000,
        "metaSpend": 1130000,
        "googleSpend": 280000,
        "totalAdsIncluded": 1410000,
        "amazonAdsSpendEst": 710000,
        "flipkartAdsSpend": 190000,
        "salesPerRupeeAd": 3.94,
        "amazonShare": 65.9,
        "shopifyOrders": 3214,
        "amazonOrders": 7370,
        "metaROAS": 1.55,
        "googleROAS": 2.65,
        "realisticNetProfit": 1290000,
        "contributionMargin": 23.3
    },
    {
        "month": "Jun 2026",
        "shopifyPreReturns": 2100000,
        "shopifyNet": 1820000,
        "amazonSales": 3260000,
        "totalSales": 5360000,
        "flipkartSalesEst": 920000,
        "metaSpend": 1250000,
        "googleSpend": 390000,
        "totalAdsIncluded": 1640000,
        "amazonAdsSpendEst": 690000,
        "flipkartAdsSpend": 210000,
        "salesPerRupeeAd": 3.27,
        "amazonShare": 60.8,
        "shopifyOrders": 3934,
        "amazonOrders": 6765,
        "metaROAS": 1.52,
        "googleROAS": 1.48, # Google spend spike
        "realisticNetProfit": 940000,
        "contributionMargin": 17.5
    },
    {
        "month": "Jul 2026",
        "shopifyPreReturns": 2330000,
        "shopifyNet": 1980000,
        "amazonSales": 3500000,
        "totalSales": 5830000,
        "flipkartSalesEst": 980000,
        "metaSpend": 1340000,
        "googleSpend": 350000,
        "totalAdsIncluded": 1690000,
        "amazonAdsSpendEst": 740000,
        "flipkartAdsSpend": 220000,
        "salesPerRupeeAd": 3.45,
        "amazonShare": 60.0,
        "shopifyOrders": 4357,
        "amazonOrders": 7260,
        "metaROAS": 1.62,
        "googleROAS": 2.30,
        "realisticNetProfit": 1150000,
        "contributionMargin": 19.7
    },
    {
        "month": "Aug 2026",
        "shopifyPreReturns": 2270000,
        "shopifyNet": 1280000, # Large reversal month
        "amazonSales": 3120000,
        "totalSales": 5390000,
        "flipkartSalesEst": 1050000,
        "metaSpend": 1320000,
        "googleSpend": 340000,
        "totalAdsIncluded": 1660000,
        "amazonAdsSpendEst": 720000,
        "flipkartAdsSpend": 225000,
        "salesPerRupeeAd": 3.24,
        "amazonShare": 57.9,
        "shopifyOrders": 4296,
        "amazonOrders": 6526,
        "metaROAS": 1.65,
        "googleROAS": 2.25,
        "realisticNetProfit": 710000,
        "contributionMargin": 13.2
    },
    {
        "month": "Sep 2026",
        "shopifyPreReturns": 3000000,
        "shopifyNet": 2680000,
        "amazonSales": 2840000,
        "totalSales": 5840000,
        "flipkartSalesEst": 1120000,
        "metaSpend": 1780000,
        "googleSpend": 380000,
        "totalAdsIncluded": 2160000,
        "amazonAdsSpendEst": 780000,
        "flipkartAdsSpend": 230000,
        "salesPerRupeeAd": 2.70,
        "amazonShare": 48.6,
        "shopifyOrders": 6065,
        "amazonOrders": 5958,
        "metaROAS": 1.76,
        "googleROAS": 2.12,
        "realisticNetProfit": 860000,
        "contributionMargin": 14.7
    },
    {
        "month": "Oct 2026 (MTD)",
        "shopifyPreReturns": 2700000,
        "shopifyNet": 2420000,
        "amazonSales": 2980000,
        "totalSales": 5680000,
        "flipkartSalesEst": 1450000,
        "metaSpend": 1540000,
        "googleSpend": 370000,
        "totalAdsIncluded": 1910000,
        "amazonAdsSpendEst": 820000,
        "flipkartAdsSpend": 251000,
        "salesPerRupeeAd": 2.98,
        "amazonShare": 52.5,
        "shopifyOrders": 5773,
        "amazonOrders": 6794,
        "metaROAS": 1.87,
        "googleROAS": 2.56,
        "realisticNetProfit": 1020000,
        "contributionMargin": 18.0
    }
]

# 5. Load Amazon ASIN Business Report
amazon_business_data = []
biz_file = os.path.join(parent_dir, "BusinessReport-14-10-26 (1).csv")
if os.path.exists(biz_file):
    with open(biz_file, mode='r', encoding='utf-8') as f:
        reader = csv.reader(f)
        header = next(reader)
        for r in reader:
            if len(r) >= 5:
                parent_asin = r[0].strip()
                child_asin = r[1].strip()
                title = r[2].strip()
                units = int(r[3].replace(',', '').strip()) if r[3].strip() else 0
                orders = int(r[4].replace(',', '').strip()) if r[4].strip() else 0
                amazon_business_data.append({
                    "parentAsin": parent_asin,
                    "childAsin": child_asin,
                    "title": title,
                    "unitsOrdered": units,
                    "totalOrderItems": orders,
                    "estRevenue": units * (999 if "100" in title else (499 if "Rosemary" in title or "30" in title else 585))
                })

# 6. Load Shan-Report-Sheet for Amazon Inventory Plan & Listings
amazon_inventory_plan = []
sheet_file = os.path.join(parent_dir, "Copy of Shan-Report-Sheet.xlsx")
if os.path.exists(sheet_file):
    try:
        wb = openpyxl.load_workbook(sheet_file, data_only=True)
        if 'Amz-Inventory Plan' in wb.sheetnames:
            s = wb['Amz-Inventory Plan']
            for row in list(s.iter_rows(values_only=True))[1:30]:
                if row[1] and row[2]:
                    asin = str(row[1]).strip()
                    prod_name = str(row[2]).strip()
                    curr_inv = float(row[3]) if row[3] is not None and str(row[3]).replace('.','').isdigit() else 0
                    inbound = float(row[4]) if row[4] is not None and str(row[4]).replace('.','').isdigit() else 0
                    avg_sale = float(row[5]) if row[5] is not None and str(row[5]).replace('.','').isdigit() else 0
                    needed = float(row[7]) if row[7] is not None and str(row[7]).replace('.','').isdigit() else 0
                    amazon_inventory_plan.append({
                        "asin": asin,
                        "product": prod_name,
                        "currentInventory": curr_inv,
                        "inbound": inbound,
                        "avgMonthlySale": avg_sale,
                        "neededToSend": needed,
                        "daysOfCover": round((curr_inv / (avg_sale / 30.0)), 1) if avg_sale > 0 else 99
                    })
    except Exception as e:
        print(f"Error parsing Shan-Report-Sheet: {e}")

# 7. Meta Accounts Breakdown
META_ACCOUNTS = [
    {"name": "New26", "accountId": "1274462564675838", "status": "Active", "share": 38.5, "spendOct": 593000, "purchasesOct": 1045, "roasOct": 1.94, "strategy": "Scale / Evergreen Prospecting"},
    {"name": "Auravedic Internal", "accountId": "636601780205220", "status": "Active", "share": 24.2, "spendOct": 372000, "purchasesOct": 670, "roasOct": 1.88, "strategy": "Middle of Funnel / Retargeting"},
    {"name": "MP2", "accountId": "1506928486493862", "status": "Active", "share": 19.8, "spendOct": 305000, "purchasesOct": 530, "roasOct": 1.78, "strategy": "Combo & Hero Push"},
    {"name": "Auravedic GC", "accountId": "1030922277728502", "status": "Active", "share": 12.1, "spendOct": 186000, "purchasesOct": 320, "roasOct": 1.82, "strategy": "Broad Interest Tests"},
    {"name": "Fresh Pixel", "accountId": "434037959170111", "status": "Active", "share": 5.4, "spendOct": 84000, "purchasesOct": 145, "roasOct": 1.62, "strategy": "Initiate Checkout Optimised (Remarketing)"},
    {"name": "Auravedic Admin", "accountId": "100149933695451", "status": "Excluded", "share": 0.0, "spendOct": 0, "purchasesOct": 0, "roasOct": 0.0, "strategy": "Admin Account - Always Excluded"}
]

# 8. Warehouse Closing Stock & Operations (CBE vs Mumbai)
WAREHOUSE_STOCK = [
    {"key": "K100", "name": "Kumkumadi Oil 100ml", "cbeD2CAvl": 2840, "cbeBulkReserve": 1200, "cbeSIH": 4040, "mumbaiSIH": 3150, "totalStock": 7190, "dailyRunRate": 165, "daysOfCover": 43.5, "reorderNeeded": False},
    {"key": "K30", "name": "Kumkumadi Tailam 30ml", "cbeD2CAvl": 420, "cbeBulkReserve": 200, "cbeSIH": 620, "mumbaiSIH": 510, "totalStock": 1130, "dailyRunRate": 35, "daysOfCover": 32.2, "reorderNeeded": False},
    {"key": "KNC", "name": "Kumkumadi Night Cream 50g", "cbeD2CAvl": 180, "cbeBulkReserve": 50, "cbeSIH": 230, "mumbaiSIH": 290, "totalStock": 520, "dailyRunRate": 48, "daysOfCover": 10.8, "reorderNeeded": True},
    {"key": "RHO", "name": "Rosemary Hair Oil 100ml", "cbeD2CAvl": 950, "cbeBulkReserve": 400, "cbeSIH": 1350, "mumbaiSIH": 1120, "totalStock": 2470, "dailyRunRate": 62, "daysOfCover": 39.8, "reorderNeeded": False},
    {"key": "KGEL", "name": "Kumkumadi Gel 100g", "cbeD2CAvl": 210, "cbeBulkReserve": 100, "cbeSIH": 310, "mumbaiSIH": 180, "totalStock": 490, "dailyRunRate": 38, "daysOfCover": 12.8, "reorderNeeded": True},
    {"key": "KC", "name": "Kumkumadi Cream 100g", "cbeD2CAvl": 340, "cbeBulkReserve": 150, "cbeSIH": 490, "mumbaiSIH": 410, "totalStock": 900, "dailyRunRate": 32, "daysOfCover": 28.1, "reorderNeeded": False},
    {"key": "KNS", "name": "Kumkumadi Night Serum 50ml", "cbeD2CAvl": 95, "cbeBulkReserve": 50, "cbeSIH": 145, "mumbaiSIH": 120, "totalStock": 265, "dailyRunRate": 42, "daysOfCover": 6.3, "reorderNeeded": True},
    {"key": "SBO", "name": "Skin Brightening Oil 100ml", "cbeD2CAvl": 680, "cbeBulkReserve": 200, "cbeSIH": 880, "mumbaiSIH": 750, "totalStock": 1630, "dailyRunRate": 24, "daysOfCover": 67.9, "reorderNeeded": False},
    {"key": "RBMO", "name": "Relaxing Body Massage Oil 200ml", "cbeD2CAvl": 820, "cbeBulkReserve": 300, "cbeSIH": 1120, "mumbaiSIH": 980, "totalStock": 2100, "dailyRunRate": 36, "daysOfCover": 58.3, "reorderNeeded": False}
]

# 9. State-Wise COD & RTO Risk
STATE_COD_RISK = [
    {"state": "Maharashtra", "region": "West", "orders": 1840, "codShare": 42.0, "rtoRate": 4.8, "riskLevel": "Low", "revenue": 1650000},
    {"state": "Karnataka", "region": "South", "orders": 1420, "codShare": 38.5, "rtoRate": 3.9, "riskLevel": "Low", "revenue": 1320000},
    {"state": "Tamil Nadu", "region": "South", "orders": 1280, "codShare": 35.0, "rtoRate": 3.5, "riskLevel": "Low", "revenue": 1180000},
    {"state": "Delhi NCR", "region": "North", "orders": 1150, "codShare": 45.2, "rtoRate": 6.2, "riskLevel": "Medium", "revenue": 1050000},
    {"state": "Telangana", "region": "South", "orders": 890, "codShare": 40.0, "rtoRate": 4.5, "riskLevel": "Low", "revenue": 810000},
    {"state": "Uttar Pradesh", "region": "North", "orders": 820, "codShare": 68.0, "rtoRate": 16.5, "riskLevel": "High", "revenue": 710000},
    {"state": "Rajasthan", "region": "North", "orders": 640, "codShare": 64.5, "rtoRate": 18.2, "riskLevel": "Critical (High RTO)", "revenue": 560000},
    {"state": "West Bengal", "region": "East", "orders": 580, "codShare": 62.0, "rtoRate": 17.8, "riskLevel": "Critical (High RTO)", "revenue": 490000},
    {"state": "Bihar", "region": "East", "orders": 490, "codShare": 74.0, "rtoRate": 24.5, "riskLevel": "Critical (High RTO)", "revenue": 410000},
    {"state": "Assam", "region": "East", "orders": 360, "codShare": 71.5, "rtoRate": 22.0, "riskLevel": "Critical (High RTO)", "revenue": 310000},
    {"state": "Jammu & Kashmir", "region": "North", "orders": 210, "codShare": 69.0, "rtoRate": 21.5, "riskLevel": "Critical (High RTO)", "revenue": 190000}
]

# 10. Multi-channel marketplace summary (Nykaa & Myntra included)
MARKETPLACE_SUMMARY = [
    {"channel": "Shopify D2C", "type": "Store", "monthlyRevenue": 2700000, "sharePercent": 41.5, "orders": 5773, "aov": 467, "returnRate": 5.2, "status": "Live & Scaling"},
    {"channel": "Amazon.in", "type": "Marketplace", "monthlyRevenue": 2980000, "sharePercent": 45.8, "orders": 6794, "aov": 438, "returnRate": 4.8, "status": "Live & Core"},
    {"channel": "Flipkart", "type": "Marketplace", "monthlyRevenue": 1450000, "sharePercent": 22.3, "orders": 3356, "aov": 432, "returnRate": 13.5, "status": "Live (Report upload)"},
    {"channel": "Nykaa", "type": "Marketplace", "monthlyRevenue": 380000, "sharePercent": 5.8, "orders": 620, "aov": 612, "returnRate": 6.1, "status": "Active (Catalog mapped)", "adSpend": 37400, "adRoas": 4.05, "skusMapped": 89},
    {"channel": "Myntra", "type": "Marketplace", "monthlyRevenue": 185000, "sharePercent": 2.8, "orders": 310, "aov": 596, "returnRate": 9.4, "status": "Active", "adSpend": 6800, "adRoas": 3.16}
]

# Write out files
data_bundle = {
    "baseProducts": BASE_PRODUCTS,
    "recipes": RECIPES,
    "unitEconomics": UNIT_ECONOMICS,
    "monthlyPerformance": MONTHLY_PERFORMANCE,
    "amazonBusinessData": amazon_business_data,
    "amazonInventoryPlan": amazon_inventory_plan,
    "metaAccounts": META_ACCOUNTS,
    "warehouseStock": WAREHOUSE_STOCK,
    "stateCodRisk": STATE_COD_RISK,
    "marketplaceSummary": MARKETPLACE_SUMMARY,
    "freshness": {
        "metaAds": "2026-10-25 23:59 IST",
        "googleAds": "2026-10-25 23:59 IST",
        "shopifySales": "2026-10-25 23:59 IST",
        "amazonSales": "2026-10-25 23:59 IST",
        "amazonSettlement": "2026-10-25 23:59 IST (13-25 Oct daily)",
        "flipkartOrders": "2026-10-29 23:59 IST",
        "warehouseStock": "2026-10-29 23:00 IST",
        "assumptions": {
            "defaultCOGS": 125,
            "flatShipping": 65,
            "freeShippingThreshold": 499,
            "freeTonerThreshold": 1200
        }
    }
}

json_path = os.path.join(out_dir, 'dashboardData.json')
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(data_bundle, f, indent=2, ensure_ascii=False)

# Also generate a TypeScript wrapper with typed exports
ts_content = f"""// Auto-generated seed data bundle for Auravedic Cross-Channel Performance Dashboard
import rawData from './dashboardData.json';

export interface BaseProduct {{
  key: string;
  name: string;
  category: string;
  mrp: number;
  defaultCost: number;
  hero: boolean;
}}

export interface Recipe {{
  code: string;
  title: string;
  type: 'S' | 'P' | 'C';
  channel: string;
  parts: Record<string, number>;
  sellingPrice: number;
}}

export interface UnitEconomicItem {{
  name: string;
  cogs: number;
  shipping: number;
  metaCAC: number;
  sellingPrice: number;
  rtoCost: number;
  netProfitWithRTO: number;
  netProfitWithoutRTO: number;
  marginPercent: number;
}}

export interface MonthlyMetric {{
  month: string;
  shopifyPreReturns: number;
  shopifyNet: number;
  amazonSales: number;
  totalSales: number;
  flipkartSalesEst: number;
  metaSpend: number;
  googleSpend: number;
  totalAdsIncluded: number;
  amazonAdsSpendEst: number;
  flipkartAdsSpend: number;
  salesPerRupeeAd: number;
  amazonShare: number;
  shopifyOrders: number;
  amazonOrders: number;
  metaROAS: number;
  googleROAS: number;
  realisticNetProfit: number;
  contributionMargin: number;
}}

export interface AmazonASINItem {{
  parentAsin: string;
  childAsin: string;
  title: string;
  unitsOrdered: number;
  totalOrderItems: number;
  estRevenue: number;
}}

export interface AmazonInventoryPlanItem {{
  asin: string;
  product: string;
  currentInventory: number;
  inbound: number;
  avgMonthlySale: number;
  neededToSend: number;
  daysOfCover: number;
}}

export interface MetaAccount {{
  name: string;
  accountId: string;
  status: string;
  share: number;
  spendOct: number;
  purchasesOct: number;
  roasOct: number;
  strategy: string;
}}

export interface WarehouseItem {{
  key: string;
  name: string;
  cbeD2CAvl: number;
  cbeBulkReserve: number;
  cbeSIH: number;
  mumbaiSIH: number;
  totalStock: number;
  dailyRunRate: number;
  daysOfCover: number;
  reorderNeeded: boolean;
}}

export interface StateCodRiskItem {{
  state: string;
  region: string;
  orders: number;
  codShare: number;
  rtoRate: number;
  riskLevel: string;
  revenue: number;
}}

export interface MarketplaceItem {{
  channel: string;
  type: string;
  monthlyRevenue: number;
  sharePercent: number;
  orders: number;
  aov: number;
  returnRate: number;
  status: string;
  /** Platform ad spend for the month and its return per rupee (marketplaces without an API feed). */
  adSpend?: number;
  adRoas?: number;
  skusMapped?: number;
  /** Month the figures cover, when it differs from the dashboard period (e.g. "Aug 2026"). */
  periodLabel?: string;
}}

/** One month of a marketplace's own ad report (Shan's report sheet). */
export interface MarketplaceAdsItem {{
  channel: string;
  month: string; // "Sep 2026"
  monthKey: string; // "2026-09"
  adSpend: number;
  adRevenue?: number;
  adRoas?: number;
  adOrders?: number;
  totalOrders?: number;
  totalRevenue?: number;
  /** Ad spend as a % of the channel's total revenue. */
  tacos?: number;
}}

export interface FreshnessInfo {{
  metaAds: string;
  googleAds: string;
  shopifySales: string;
  amazonSales: string;
  amazonSettlement: string;
  flipkartOrders: string;
  warehouseStock: string;
  assumptions: {{
    defaultCOGS: number;
    flatShipping: number;
    freeShippingThreshold: number;
    freeTonerThreshold: number;
  }};
}}

export interface DashboardDataBundle {{
  baseProducts: BaseProduct[];
  recipes: Recipe[];
  unitEconomics: Record<string, UnitEconomicItem>;
  monthlyPerformance: MonthlyMetric[];
  amazonBusinessData: AmazonASINItem[];
  amazonInventoryPlan: AmazonInventoryPlanItem[];
  metaAccounts: MetaAccount[];
  warehouseStock: WarehouseItem[];
  stateCodRisk: StateCodRiskItem[];
  marketplaceSummary: MarketplaceItem[];
  marketplaceAds?: MarketplaceAdsItem[];
  freshness: FreshnessInfo;
}}

export const initialDashboardData: DashboardDataBundle = rawData as DashboardDataBundle;
"""

ts_path = os.path.join(out_dir, 'initialData.ts')
with open(ts_path, 'w', encoding='utf-8') as f:
    f.write(ts_content)

print(f"Data extraction complete. Wrote {len(BASE_PRODUCTS)} base products, {len(RECIPES)} recipes, {len(MONTHLY_PERFORMANCE)} monthly rows, {len(amazon_business_data)} Amazon ASINs, {len(amazon_inventory_plan)} inventory ASINs to {json_path} and {ts_path}")
