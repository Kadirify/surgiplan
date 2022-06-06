import { Avatar, AvatarProps } from '@mui/material';
import { initials } from '@/lib/format';

export function UserAvatar({ name, size = 32, sx, ...rest }: { name: string; size?: number } & AvatarProps) {
  return (
    <Avatar sx={{ width: size, height: size, fontSize: size * 0.4, fontWeight: 500, bgcolor: '#78909c', ...sx }} {...rest}>
      {initials(name)}
    </Avatar>
  );
}
