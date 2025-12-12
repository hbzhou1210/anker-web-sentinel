import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from './services/queries';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Home } from './pages/Home';
import { Report } from './pages/Report';
import { ComingSoon } from './pages/ComingSoon';
import { TestPointExtraction } from './pages/TestPointExtraction';
import ResponsiveTesting from './pages/ResponsiveTesting';
import PatrolManagement from './pages/PatrolManagement';
import LinkCrawler from './pages/LinkCrawler';
import './App.css';

// Create QueryClient instance
const queryClient = createQueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Home />} />
            <Route path="report/:reportId" element={<Report />} />

            {/* 官方网站 */}
            <Route path="official" element={<ComingSoon title="官方网站" description="企业官方网站展示页面" />} />

            {/* 仪表盘 */}
            <Route path="dashboard" element={<ComingSoon title="仪表盘" description="数据概览和统计分析" />} />

            {/* 系统管理 */}
            <Route path="system/users" element={<ComingSoon title="用户管理" />} />
            <Route path="system/roles" element={<ComingSoon title="角色管理" />} />

            {/* 商品管理 */}
            <Route path="products/list" element={<ComingSoon title="商品列表" />} />
            <Route path="products/categories" element={<ComingSoon title="分类管理" />} />

            {/* 内容管理 */}
            <Route path="content/articles" element={<ComingSoon title="文章管理" />} />
            <Route path="content/media" element={<ComingSoon title="媒体库" />} />

            {/* 营销管理 */}
            <Route path="marketing" element={<ComingSoon title="营销管理" />} />

            {/* 用户管理 */}
            <Route path="users/list" element={<ComingSoon title="用户列表" />} />
            <Route path="users/groups" element={<ComingSoon title="用户组" />} />

            {/* 工具管理 */}
            <Route path="tools/test-points" element={<TestPointExtraction />} />
            <Route path="tools/responsive" element={<ResponsiveTesting />} />
            <Route path="tools/patrol" element={<PatrolManagement />} />
            <Route path="tools/link-crawler" element={<LinkCrawler />} />
            <Route path="tools/monitor" element={<ComingSoon title="监控工具" />} />

            {/* 资产管理 */}
            <Route path="assets/list" element={<ComingSoon title="资产列表" />} />
            <Route path="assets/reports" element={<ComingSoon title="资产报表" />} />

            {/* 店铺配置 */}
            <Route path="shop/basic" element={<ComingSoon title="基础配置" />} />
            <Route path="shop/theme" element={<ComingSoon title="主题设置" />} />

            {/* 订单管理 */}
            <Route path="orders/list" element={<ComingSoon title="订单列表" />} />
            <Route path="orders/refund" element={<ComingSoon title="退款管理" />} />

            {/* 服务管理 */}
            <Route path="services/list" element={<ComingSoon title="服务列表" />} />
            <Route path="services/config" element={<ComingSoon title="服务配置" />} />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

// 404 Not Found page
function NotFound() {
  return (
    <div className="not-found-page">
      <div className="not-found-content">
        <h1>404</h1>
        <h2>页面不存在</h2>
        <p>您访问的页面未找到</p>
        <a href="/" className="home-link">
          返回首页
        </a>
      </div>
    </div>
  );
}

export default App;
