
import { RouteObject } from 'react-router-dom';
import { lazy } from 'react';

const HomePage = lazy(() => import('../pages/home/page'));
const BookingFlowPage = lazy(() => import('../pages/booking-flow/page'));
const PaymentPage = lazy(() => import('../pages/payment/page'));
const SquarePaymentPage = lazy(() => import('../pages/square-payment/page'));
const PaymentPendingPage = lazy(() => import('../pages/payment-pending/page'));
const ConfirmationPage = lazy(() => import('../pages/confirmation/page'));
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
    path: '/payment',
    element: <PaymentPage />,
  },
  {
    path: '/square-payment',
    element: <SquarePaymentPage />,
  },
  {
    path: '/payment-pending',
    element: <PaymentPendingPage />,
  },
  {
    path: '/confirmation',
    element: <ConfirmationPage />,
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
