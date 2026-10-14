
import { RouteObject } from 'react-router-dom';
import { lazy } from 'react';

const HomePage = lazy(() => import('../pages/home/page'));
const BookingFlowPage = lazy(() => import('../pages/booking-flow/page'));
const RoomDetailPage = lazy(() => import('../pages/room-detail/page'));
const CancelPage = lazy(() => import('../pages/cancel/page'));
const NotFoundPage = lazy(() => import('../pages/NotFound'));

const routes: RouteObject[] = [
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/booking-flow',
    element: <BookingFlowPage />,
  },
  {
    path: '/room/:id',
    element: <RoomDetailPage />,
  },
  {
    path: '/cancel/:token',
    element: <CancelPage />,
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];

export default routes;
