# 🎬 Netflix User Engagement & Revenue Optimization Analysis

## 📌 Executive Summary
This project analyzes a dataset of 25,000 Netflix users to uncover actionable business insights aimed at maximizing profitability and improving user retention. By examining viewing habits, demographic data, and subscription tiers, this analysis identifies a **massive untapped revenue opportunity**: upselling highly engaged "Basic" tier users to the "Premium" plan. 

## 🛠️ Tech Stack Used
* **Microsoft Excel:** Data cleaning, handling missing values, and formatting date structures for consistency.
* **SQL:** Data exploration, querying user segments, and calculating aggregate metrics (e.g., average watch times, age grouping).
* **Power BI:** Building interactive dashboards for data visualization and presenting insights to stakeholders.

---

<img width="1315" height="743" alt="Screenshot 2026-03-17 123346" src="https://github.com/user-attachments/assets/d04b4196-b44a-4eb6-9e02-d815c66428c4" />

## 📊 Key Business Insights

### 1. The "Basic" Plan Goldmine (Massive Upsell Opportunity)
The most critical finding of this analysis is the hidden value within the "Basic" subscriber base. 
* **The Insight:** Data shows that "Basic" users consume just as much content as "Premium" users (averaging ~502 hours vs. ~501 hours respectively). 
* **The Business Impact:** Because Basic users are utilizing the platform's bandwidth and server resources at the exact same rate as Premium users but paying significantly less, the cost-to-serve ratio is unbalanced. 
* **The Profit Potential:** There is a massive opportunity to increase Monthly Recurring Revenue (MRR) without acquiring a single new customer. By successfully converting a fraction of these highly engaged Basic users to Premium, the business will see an immediate and substantial boost in pure profit.

### 2. Knowing the Target Audience (Demographics & Preferences)
To effectively target these users for an upsell, we analyzed their specific profiles:
* **Average Age:** The average user on the platform is **46.5 years old**. This indicates a mature demographic with likely higher disposable income, making them prime candidates for premium upgrades (e.g., 4K viewing, multiple screens for family).
* **Content Preferences:** Engagement is heavily driven by specific genres. **Romance** (avg. 506.9 hours) and **Drama** (avg. 504.5 hours) are the undisputed leaders in watch time, outperforming action and horror.

### 3. The Churn Vulnerability
While engagement among active users is high, the dataset reveals a concerning trend regarding recency. A significant portion of the total user base has not logged in for over 90 days. Retaining these users before their next billing cycle is critical to maintaining baseline revenue.

---

## 💡 Strategic Recommendations

Based on the data, I recommend the following actionable steps for the business/marketing teams:

1. **Launch a Targeted Upsell Campaign:** * Identify "Basic" users who have watched more than 400 hours of content.
   * Send them a targeted offer: *"You love Netflix! Upgrade to Premium today for 30 days free to watch your favorite shows in Ultra HD."*
   * Because their engagement is already proven, the conversion rate on this trial will be exceptionally high.

2. **Personalize Marketing via "Romance & Drama":**
   * Since our core demographic (average age 46) heavily prefers Drama and Romance, all upsell marketing materials and re-engagement emails should feature high-quality imagery from the platform's top shows in these genres. 

3. **Family-Plan Push for the 40+ Demographic:**
   * At age 46, many users have families. The marketing team should emphasize the "4 Concurrent Screens" feature of the Premium plan as the primary selling point to Basic users in their 40s and 50s.

4. **Implement an "At-Risk" Win-Back Trigger:**
   * Automatically send a curated list of "New Drama & Romance Releases" to any user who has not logged in for 30 days to prevent them from slipping into the "Inactive/Churned" category.

---

## 📂 Project Structure
* `netflix_users.csv/`: Contains the raw and cleaned `netflix.csv` files.
* `Netflix_users_Dashboard.pbix/`: Contains the `.pbix` file with the interactive visualizations.

## 🚀 How to View the Dashboard
1. Download the `.pbix` file from the `powerbi_dashboard` folder.
2. Open it using Microsoft Power BI Desktop.
