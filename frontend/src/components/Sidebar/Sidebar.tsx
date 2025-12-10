import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

interface MenuItem {
  key: string;
  label: string;
  icon: string;
  path?: string;
  children?: MenuItem[];
  badge?: string; // 徽章文本,如 "开发中", "新功能" 等
}

const menuItems: MenuItem[] = [
  { key: 'tools-quality-check', label: '网页质量检测', icon: '🎯', path: '/' },
  { key: 'tools-responsive', label: '移动端/响应式测试', icon: '📱', path: '/tools/responsive' },
  { key: 'tools-patrol', label: '定时巡检管理', icon: '🔍', path: '/tools/patrol' },
  { key: 'tools-test-points', label: '测试点提取', icon: '📝', path: '/tools/test-points', badge: '开发中' },
  { key: 'tools-monitor', label: '监控工具', icon: '📡', path: '/tools/monitor', badge: '开发中' },
];

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  const toggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    return location.pathname === path;
  };

  const renderMenuItem = (item: MenuItem) => {
    const active = isActive(item.path);

    return (
      <Link
        key={item.key}
        to={item.path || '#'}
        className={`menu-item ${active ? 'active' : ''}`}
      >
        <span className="menu-icon">{item.icon}</span>
        {!collapsed && (
          <>
            <span className="menu-label">{item.label}</span>
            {item.badge && <span className="menu-badge">{item.badge}</span>}
          </>
        )}
      </Link>
    );
  };

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="logo-icon">DTC</span>
          {!collapsed && <span className="logo-text">测试工具</span>}
        </div>
        <button className="collapse-btn" onClick={toggleCollapse}>
          {collapsed ? '☰' : '✕'}
        </button>
      </div>
      <div className="sidebar-menu">{menuItems.map(renderMenuItem)}</div>
    </div>
  );
};
