import {
  AppBar,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import AddIcon from '@mui/icons-material/Add';
import TvIcon from '@mui/icons-material/Tv';
import { Permission, roleLabels } from '@surgiplan/shared';
import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import { useSurgeries } from '@/api/queries';
import { useAuth, useMe } from '@/auth/AuthProvider';
import { Logo } from '@/components/Logo';
import { personName } from '@/lib/format';
import { useRealtime } from '@/realtime/useRealtime';
import { useColorMode } from './ColorMode';
import { adminNav, mainNav, NavItem } from './navigation';
import { NotificationsMenu } from './NotificationsMenu';

function isActive(pathname: string, to: string) {
  return to === '/' ? pathname === '/' : pathname.startsWith(to);
}

export function AppLayout() {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const me = useMe();
  useRealtime(true);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <NavBar desktop={desktop} />
      <Box component="main" sx={{ flex: 1, px: { xs: 1.5, md: 3 }, py: { xs: 2, md: 2.5 }, maxWidth: 1600, width: '100%', mx: 'auto' }}>
        {me.mustChangePassword && (
          <Box sx={{ mb: 2, px: 2, py: 1, border: 1, borderColor: 'warning.main', bgcolor: 'background.paper', fontSize: 14 }}>
            Geçici bir şifre kullanıyorsunuz. Lütfen profil sayfasından şifrenizi değiştirin.
          </Box>
        )}
        <Outlet />
      </Box>
    </Box>
  );
}

function usePendingCount() {
  const me = useMe();
  const isCoordinator = me.permissions.includes(Permission.SurgeriesSchedule);
  const { data } = useSurgeries({ status: ['PENDING_APPROVAL'] }, isCoordinator);
  return isCoordinator ? data?.length ?? 0 : 0;
}

function NavBar({ desktop }: { desktop: boolean }) {
  const me = useMe();
  const { logout, can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, setMode } = useColorMode();
  const pending = usePendingCount();
  const [userMenu, setUserMenu] = useState<HTMLElement | null>(null);
  const [adminMenu, setAdminMenu] = useState<HTMLElement | null>(null);
  const [drawer, setDrawer] = useState(false);

  const items = mainNav.filter((i) => i.visible(me));
  const adminItems = adminNav.filter((i) => i.visible(me));

  const toggleMode = () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    api.patch('/auth/me', { theme: next }).catch(() => undefined);
  };

  const linkSx = (active: boolean) => ({
    color: active ? 'navbar.text' : 'navbar.muted',
    height: 52,
    px: 1.5,
    borderRadius: 0,
    fontSize: 14,
    fontWeight: active ? 500 : 400,
    borderBottom: '3px solid',
    borderColor: active ? 'navbar.active' : 'transparent',
    '&:hover': { color: 'navbar.text', bgcolor: 'rgba(255,255,255,0.06)' },
  });

  const label = (item: NavItem) =>
    item.badge === 'pending' && pending > 0 ? (
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
        {item.label}
        <Box component="span" sx={{ bgcolor: 'warning.main', color: '#fff', fontSize: 11, fontWeight: 500, lineHeight: '17px', minWidth: 18, px: 0.5, borderRadius: '9px', textAlign: 'center' }}>
          {pending}
        </Box>
      </Box>
    ) : (
      item.label
    );

  return (
    <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'navbar.bg', color: 'navbar.text', borderBottom: '1px solid rgba(0,0,0,0.3)' }}>
      <Toolbar disableGutters sx={{ minHeight: '52px !important', px: { xs: 1, md: 3 }, gap: 0.5 }}>
        {!desktop && (
          <IconButton color="inherit" onClick={() => setDrawer(true)}>
            <MenuIcon />
          </IconButton>
        )}
        <Box component={NavLink} to="/" sx={{ textDecoration: 'none', mr: { md: 3 }, display: 'flex', alignItems: 'center' }}>
          <Logo inverted />
        </Box>

        {desktop && (
          <Box sx={{ display: 'flex', alignItems: 'stretch', height: 52 }}>
            {items.map((item) => (
              <Button key={item.to} component={NavLink} to={item.to} sx={linkSx(isActive(location.pathname, item.to))}>
                {label(item)}
              </Button>
            ))}
            {adminItems.length > 0 && (
              <>
                <Button
                  endIcon={<ArrowDropDownIcon />}
                  onClick={(e) => setAdminMenu(e.currentTarget)}
                  sx={linkSx(location.pathname.startsWith('/admin'))}
                >
                  Yönetim
                </Button>
                <Menu anchorEl={adminMenu} open={!!adminMenu} onClose={() => setAdminMenu(null)}>
                  {adminItems.map((item) => (
                    <MenuItem
                      key={item.to}
                      selected={isActive(location.pathname, item.to)}
                      onClick={() => {
                        setAdminMenu(null);
                        navigate(item.to);
                      }}
                    >
                      {item.label}
                    </MenuItem>
                  ))}
                </Menu>
              </>
            )}
          </Box>
        )}

        <Box sx={{ flex: 1 }} />

        {desktop && can(Permission.SurgeriesCreate) && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => navigate('/surgeries/new')}
            sx={{ color: 'navbar.text', borderColor: 'rgba(255,255,255,0.35)', mr: 1, '&:hover': { borderColor: '#fff' } }}
          >
            Yeni Talep
          </Button>
        )}
        <Tooltip title="Canlı pano">
          <IconButton color="inherit" onClick={() => navigate('/board')}>
            <TvIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={mode === 'dark' ? 'Açık tema' : 'Koyu tema'}>
          <IconButton color="inherit" onClick={toggleMode}>
            {mode === 'dark' ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <NotificationsMenu />
        <Button
          color="inherit"
          onClick={(e) => setUserMenu(e.currentTarget)}
          endIcon={<ArrowDropDownIcon />}
          sx={{ ml: 0.5, textAlign: 'left', lineHeight: 1.2, display: 'block', py: 0.5 }}
        >
          <Box component="span" sx={{ display: 'block', fontSize: 13, fontWeight: 500, maxWidth: { xs: 110, sm: 200 }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {personName(me)}
          </Box>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'block' }, fontSize: 11, color: 'navbar.muted' }}>
            {roleLabels[me.role]}
          </Box>
        </Button>
        <Menu
          anchorEl={userMenu}
          open={!!userMenu}
          onClose={() => setUserMenu(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Box sx={{ px: 2, py: 0.75 }}>
            <Typography variant="caption" color="text.secondary">
              {me.email}
            </Typography>
          </Box>
          <Divider />
          <MenuItem
            onClick={() => {
              setUserMenu(null);
              navigate('/profile');
            }}
          >
            <ListItemIcon>
              <PersonOutlineIcon fontSize="small" />
            </ListItemIcon>
            Profil ve ayarlar
          </MenuItem>
          <MenuItem
            onClick={async () => {
              setUserMenu(null);
              await logout();
              navigate('/login');
            }}
          >
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            Çıkış
          </MenuItem>
        </Menu>
      </Toolbar>

      {!desktop && (
        <Drawer open={drawer} onClose={() => setDrawer(false)} PaperProps={{ sx: { width: 260 } }}>
          <Box sx={{ height: 52, px: 2, display: 'flex', alignItems: 'center', bgcolor: 'navbar.bg' }}>
            <Logo inverted />
          </Box>
          <List dense>
            {can(Permission.SurgeriesCreate) && (
              <ListItemButton
                onClick={() => {
                  setDrawer(false);
                  navigate('/surgeries/new');
                }}
              >
                <ListItemText primary="+ Yeni Talep" primaryTypographyProps={{ color: 'primary', fontWeight: 500 }} />
              </ListItemButton>
            )}
            {items.map((item) => (
              <ListItemButton key={item.to} component={NavLink} to={item.to} selected={isActive(location.pathname, item.to)} onClick={() => setDrawer(false)}>
                <ListItemText primary={item.label} />
                {item.badge === 'pending' && pending > 0 && <Badge badgeContent={pending} color="warning" sx={{ mr: 1 }} />}
              </ListItemButton>
            ))}
          </List>
          {adminItems.length > 0 && (
            <List dense subheader={<ListSubheader>Yönetim</ListSubheader>}>
              {adminItems.map((item) => (
                <ListItemButton key={item.to} component={NavLink} to={item.to} selected={isActive(location.pathname, item.to)} onClick={() => setDrawer(false)}>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              ))}
            </List>
          )}
        </Drawer>
      )}
    </AppBar>
  );
}
