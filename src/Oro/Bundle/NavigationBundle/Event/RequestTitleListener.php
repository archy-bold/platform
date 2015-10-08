<?php

namespace Oro\Bundle\NavigationBundle\Event;

use Oro\Bundle\NavigationBundle\Provider\TitleServiceInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpKernel\Event\GetResponseEvent;
use Symfony\Component\HttpKernel\HttpKernel;

class RequestTitleListener
{
    /** @var TitleServiceInterface */
    private $titleService = false;

    /** @var ContainerInterface */
    private $container;

    /**
     * @param ContainerInterface $container
     */
    public function __construct(ContainerInterface $container)
    {
        $this->container = $container;
    }

    /**
     * Find title for current route in database
     *
     * @param GetResponseEvent $event
     */
    public function onKernelRequest(GetResponseEvent $event)
    {
        $request = $event->getRequest();
        if (HttpKernel::MASTER_REQUEST != $event->getRequestType()
            || $request->getRequestFormat() != 'html'
            || ($request->getMethod() != 'GET'
                && !$request->headers->get(ResponseHashnavListener::HASH_NAVIGATION_HEADER))
            || ($request->isXmlHttpRequest()
                && !$request->headers->get(ResponseHashnavListener::HASH_NAVIGATION_HEADER))
        ) {
            // don't do anything
            return;
        }

        $route = $request->get('_route');

        $this->getTitleService()->loadByRoute($route);
    }

    /**
     * @return TitleServiceInterface
     */
    protected function getTitleService()
    {
        if ($this->titleService === false) {
            $this->titleService = $this->container->get('oro_navigation.title_service');
        }

        return $this->titleService;
    }
}
