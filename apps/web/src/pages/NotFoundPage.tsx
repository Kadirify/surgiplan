import { Button } from '@mui/material';
import TravelExploreRoundedIcon from '@mui/icons-material/TravelExploreRounded';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/EmptyState';

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={<TravelExploreRoundedIcon />}
      title="Sayfa bulunamadı"
      description="Aradığınız sayfa taşınmış ya da hiç var olmamış olabilir."
      action={
        <Button component={Link} to="/" variant="contained">
          Panoramaya dön
        </Button>
      }
    />
  );
}
